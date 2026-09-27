// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {RovoRegistry} from "../src/RovoRegistry.sol";
import {RovoFeeSplitter} from "../src/RovoFeeSplitter.sol";
import {RovoTypes} from "../src/RovoTypes.sol";
import {IRovoBucket} from "../src/interfaces/IRovoModules.sol";
import {LaunchFeeCollector} from "../src/LaunchFeeCollector.sol";
import {NottinghamVault} from "../src/NottinghamVault.sol";
import {HolderRewardDistributor} from "../src/HolderRewardDistributor.sol";
import {PlatformFeeReservoir} from "../src/PlatformFeeReservoir.sol";
import {RovoZapRouter, IPonsV2FactoryState, IRovoSwapAdapter} from "../src/RovoZapRouter.sol";
import {RovoFactoryWrapper} from "../src/RovoFactoryWrapper.sol";
import {LaunchFeeCollectorFactory} from "../src/LaunchFeeCollectorFactory.sol";
import {IPonsFactoryV2, IPonsLaunchAndBuyV2} from "../src/interfaces/IPonsV2.sol";

interface VmSign {
    function sign(uint256 privateKey, bytes32 digest) external returns (uint8 v, bytes32 r, bytes32 s);
    function addr(uint256 privateKey) external returns (address);
    function deal(address account, uint256 newBalance) external;
}

contract MockAtomicPonsFactory {
    address public lastFeeRecipient;
    function launchFee() external pure returns (uint256) { return 100; }
    function canLaunch(address) external pure returns (bool) { return true; }
    function maxCreatorTaxBps() external pure returns (uint16) { return 500; }
    function approvedPairTokens(address pairToken) external pure returns (bool) { return pairToken != address(0); }
    function pairTokenEconomics(address pairToken) external pure returns (uint256, uint256, uint8) {
        return pairToken == address(0) ? (0, 0, 0) : (1000, 1000, 18);
    }
    function previewLaunchEconomics(uint256, address) external pure returns (bytes32) { return bytes32(uint256(1)); }
    function launchToken(IPonsFactoryV2.TokenParams calldata params, uint256, address) external payable returns (address token, address curve) {
        require(msg.value == 100 && params.creatorFeeRecipient != address(0), "launch fee/collector");
        lastFeeRecipient = params.creatorFeeRecipient;
        return (address(0xAAA), address(0xBBB));
    }
}

contract MockAtomicPonsRouter {
    MockAtomicPonsFactory public immutable factory;
    constructor(MockAtomicPonsFactory factory_) { factory = factory_; }
    function launchAndBuy(
        IPonsFactoryV2.TokenParams calldata params, uint256 launchConfigId, address pairToken,
        uint256 quoteIn, uint256 minTokensOut, address recipient, address[] calldata
    ) external payable returns (address token, address curve, uint256 tokensOut) {
        require(quoteIn != 0 && minTokensOut != 0 && recipient != address(0), "invalid buy");
        require(msg.value == 100 + (pairToken == address(0) ? quoteIn : 0), "router value");
        (token, curve) = factory.launchToken{value: 100}(params, launchConfigId, pairToken);
        if (pairToken == address(0)) {
            (bool sent,) = payable(msg.sender).call{value: quoteIn / 2}("");
            require(sent, "native refund");
        } else {
            IERC20(pairToken).transferFrom(msg.sender, address(this), quoteIn);
            IERC20(pairToken).transfer(msg.sender, quoteIn / 2);
        }
        tokensOut = minTokensOut;
    }
}

contract MockToken is IERC20 {
    string public name = "Stock";
    string public symbol = "STOCK";
    uint8 public decimals = 18;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address to, uint256 amount) external { balanceOf[to] += amount; totalSupply += amount; }
    function approve(address spender, uint256 amount) external returns (bool) { allowance[msg.sender][spender] = amount; return true; }
    function transfer(address to, uint256 amount) external returns (bool) { _transfer(msg.sender, to, amount); return true; }
    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        if (allowed != type(uint256).max) allowance[from][msg.sender] = allowed - amount;
        _transfer(from, to, amount);
        return true;
    }
    function _transfer(address from, address to, uint256 amount) private {
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
    }
}

contract MockUsdG is MockToken {
    constructor() { decimals = 6; }
}

contract MockBucket is IRovoBucket {
    mapping(address => mapping(address => uint256)) public credited;
    function credit(address profileToken, address asset, uint256 amount) external payable {
        credited[profileToken][asset] += amount;
    }
}

contract MockCollector {
    function disperse(RovoFeeSplitter splitter, address profileToken, MockToken asset, uint256 amount) external {
        asset.transfer(address(splitter), amount);
        splitter.disperse(profileToken, address(asset), amount);
    }

    function disperseWithoutFunding(RovoFeeSplitter splitter, address profileToken, MockToken asset, uint256 amount)
        external
    {
        splitter.disperse(profileToken, address(asset), amount);
    }
}

contract MockNativeEscrow {
    mapping(address => uint256) public owed;
    mapping(address => mapping(address => uint256)) public tokenOwed;
    function fund(address recipient) external payable { owed[recipient] += msg.value; }
    function fundToken(address recipient, address token, uint256 amount) external {
        require(IERC20(token).transferFrom(msg.sender, address(this), amount), "token funding");
        tokenOwed[recipient][token] += amount;
    }
    function claim() external {
        uint256 amount = owed[msg.sender];
        owed[msg.sender] = 0;
        (bool success,) = msg.sender.call{value: amount}("");
        require(success, "escrow payout");
    }
    function claimToken(address token) external {
        uint256 amount = tokenOwed[msg.sender][token];
        tokenOwed[msg.sender][token] = 0;
        require(IERC20(token).transfer(msg.sender, amount), "token payout");
    }
}

contract UnprivilegedHarvester {
    function tryHarvest(RovoFeeSplitter splitter, address token) external returns (bool success) {
        (success,) = address(splitter).call(abi.encodeCall(splitter.harvest, (token)));
    }
    function tryHarvestBatch(RovoFeeSplitter splitter, address token) external returns (bool success) {
        address[] memory tokens = new address[](1);
        tokens[0] = token;
        (success,) = address(splitter).call(abi.encodeCall(splitter.harvestBatch, (tokens)));
    }
    function tryTreasury(LaunchFeeCollector collector) external returns (bool success) {
        (success,) = address(collector).call(abi.encodeCall(collector.collectToTreasury, ()));
    }
}

contract MockPonsCurve {
    MockToken public immutable profileToken;
    address public immutable pairToken;
    constructor(MockToken profileToken_, address pairToken_) { profileToken = profileToken_; pairToken = pairToken_; }
    function buy(uint256 quoteIn, uint256 minTokensOut, address recipient) external payable {
        uint256 spent = quoteIn / 2;
        if (pairToken == address(0)) {
            require(msg.value == quoteIn, "native quote value");
            (bool success,) = msg.sender.call{value: quoteIn - spent}("");
            require(success, "native refund");
        } else {
            require(msg.value == 0, "erc20 quote value");
            IERC20(pairToken).transferFrom(msg.sender, address(this), spent);
        }
        require(spent >= minTokensOut, "minimum output");
        profileToken.mint(recipient, spent);
    }
}

contract MockPonsPhaseFactory is IPonsV2FactoryState {
    address public curve;
    address public pairToken;
    uint8 public phase;
    constructor(address curve_, address pairToken_) { curve = curve_; pairToken = pairToken_; }
    function setPhase(uint8 phase_) external { phase = phase_; }
    function getLaunchedToken(address token) external view returns (LaunchedToken memory launch) {
        launch.token = token;
        launch.curve = curve;
        launch.pairToken = pairToken;
        launch.phase = phase;
        launch.exists = true;
    }
    function createGraduatedPool(address) external {}
}

contract MockNativeV4Adapter is IRovoSwapAdapter {
    function swapExactInput(
        address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut, address recipient, bytes calldata
    ) external payable returns (uint256 amountOut) {
        require(tokenIn == address(0) && msg.value == amountIn, "native adapter input");
        amountOut = amountIn / 2;
        require(amountOut >= minAmountOut, "adapter minimum");
        MockToken(tokenOut).mint(recipient, amountOut);
        (bool success,) = msg.sender.call{value: amountIn - amountOut}("");
        require(success, "adapter refund");
    }
}

contract RovoCoreTest {
    address private constant TREASURY = address(0xBEEF);
    VmSign private constant VM = VmSign(address(uint160(uint256(keccak256("hevm cheat code")))));
    receive() external payable {}

    function _atomicSetup() private returns (RovoFactoryWrapper wrapper, MockAtomicPonsFactory factory, RovoRegistry registry) {
        registry = new RovoRegistry(address(this));
        LaunchFeeCollectorFactory collectorFactory = new LaunchFeeCollectorFactory(address(this));
        factory = new MockAtomicPonsFactory();
        MockAtomicPonsRouter router = new MockAtomicPonsRouter(factory);
        wrapper = new RovoFactoryWrapper(
            address(this), VM.addr(12345), address(factory), address(router), address(registry),
            address(collectorFactory), address(0x1234), address(0x2345), address(0x3456), 100
        );
        registry.grantRole(registry.LAUNCHER_ROLE(), address(wrapper));
        collectorFactory.grantRole(collectorFactory.WRAPPER_ROLE(), address(wrapper));
    }

    function _atomicIdentity(RovoFactoryWrapper wrapper) private returns (
        RovoFactoryWrapper.TokenMetadata memory metadata,
        RovoFactoryWrapper.SelfRoveAttestation memory attestation,
        bytes memory signature
    ) {
        IPonsFactoryV2.Socials memory socials;
        metadata = RovoFactoryWrapper.TokenMetadata("Alice", "ALICE", "", "", socials, bytes32(uint256(123)));
        attestation = RovoFactoryWrapper.SelfRoveAttestation({
            xUserId: 77, handle: "alice", metadataHash: wrapper.hashMetadata(metadata),
            recipient: address(this), nonce: 1, deadline: block.timestamp + 300
        });
        bytes32 domain = keccak256(abi.encode(
            keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
            keccak256("Rovo Identity"), keccak256("1"), block.chainid, address(wrapper)
        ));
        bytes32 message = keccak256(abi.encode(
            wrapper.SELF_ROVE_TYPEHASH(), attestation.xUserId, keccak256(bytes(attestation.handle)),
            attestation.metadataHash, attestation.recipient, attestation.nonce, attestation.deadline
        ));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domain, message));
        (uint8 v, bytes32 r, bytes32 s) = VM.sign(12345, digest);
        signature = abi.encodePacked(r, s, v);
    }

    function testAtomicNativeLaunchAndBuyRefund() external payable {
        if (msg.value == 0) VM.deal(address(this), 1_100);
        else require(msg.value == 1_100, "test funding");
        uint256 balanceBefore = address(this).balance;
        (RovoFactoryWrapper wrapper, MockAtomicPonsFactory factory, RovoRegistry registry) = _atomicSetup();
        (RovoFactoryWrapper.TokenMetadata memory metadata, RovoFactoryWrapper.SelfRoveAttestation memory attestation, bytes memory signature) = _atomicIdentity(wrapper);
        (address token, address curve) = wrapper.launchSelfRoveAndBuy{value: 1_100}(
            metadata, 1, address(0), 100, attestation, signature, 1_000, 1
        );
        require(token == address(0xAAA) && curve == address(0xBBB), "atomic launch output");
        require(address(wrapper).balance == 0, "native refund stranded");
        RovoTypes.Launch memory launch = registry.getLaunch(token);
        require(launch.feeCollector == factory.lastFeeRecipient(), "collector not Pons recipient");
        require(launch.creator == address(this) && launch.claimed, "profile not registered");
        require(address(this).balance == balanceBefore - 600, "native refund not returned");
    }

    function testAtomicErc20LaunchAndBuyRefund() external payable {
        if (msg.value == 0) VM.deal(address(this), 100);
        else require(msg.value == 100, "test funding");
        (RovoFactoryWrapper wrapper, MockAtomicPonsFactory factory, RovoRegistry registry) = _atomicSetup();
        MockToken quote = new MockToken();
        quote.mint(address(this), 1_000);
        quote.approve(address(wrapper), 1_000);
        (RovoFactoryWrapper.TokenMetadata memory metadata, RovoFactoryWrapper.SelfRoveAttestation memory attestation, bytes memory signature) = _atomicIdentity(wrapper);
        (address token,) = wrapper.launchSelfRoveAndBuy{value: 100}(
            metadata, 1, address(quote), 100, attestation, signature, 1_000, 1
        );
        require(token == address(0xAAA), "atomic token");
        require(quote.balanceOf(address(this)) == 500 && quote.balanceOf(address(wrapper)) == 0, "quote refund");
        require(quote.allowance(address(wrapper), address(wrapper.ponsLaunchAndBuy())) == 0, "router allowance remains");
        RovoTypes.Launch memory launch = registry.getLaunch(token);
        require(launch.feeCollector == factory.lastFeeRecipient(), "collector not Pons recipient");
    }

    function testAtomicScoutLaunchAndBuy() external {
        VM.deal(address(this), 1_100);
        (RovoFactoryWrapper wrapper, MockAtomicPonsFactory factory, RovoRegistry registry) = _atomicSetup();
        (RovoFactoryWrapper.TokenMetadata memory metadata,,) = _atomicIdentity(wrapper);
        RovoFactoryWrapper.ScoutProfileAttestation memory attestation = RovoFactoryWrapper.ScoutProfileAttestation({
            xUserId: 88, handle: "scouted", metadataHash: wrapper.hashMetadata(metadata),
            nonce: 2, deadline: block.timestamp + 300
        });
        bytes32 domain = keccak256(abi.encode(
            keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
            keccak256("Rovo Identity"), keccak256("1"), block.chainid, address(wrapper)
        ));
        bytes32 message = keccak256(abi.encode(
            wrapper.SCOUT_TYPEHASH(), attestation.xUserId, keccak256(bytes(attestation.handle)),
            attestation.metadataHash, attestation.nonce, attestation.deadline
        ));
        (uint8 v, bytes32 r, bytes32 s) = VM.sign(12345, keccak256(abi.encodePacked("\x19\x01", domain, message)));
        (address token,) = wrapper.launchScoutAndBuy{value: 1_100}(
            metadata, 1, address(0), attestation, abi.encodePacked(r, s, v), 1_000, 1
        );
        RovoTypes.Launch memory launch = registry.getLaunch(token);
        require(launch.rover == address(this) && launch.creator == address(0) && !launch.claimed, "scout registration");
        require(launch.feeCollector == factory.lastFeeRecipient(), "scout collector");
    }

    function testNativeEthFeeCollectionAndRewardClaims() external payable {
        require(msg.value == 10_000, "test funding");
        RovoRegistry registry = new RovoRegistry(address(this));
        registry.grantRole(registry.LAUNCHER_ROLE(), address(this));
        NottinghamVault nottingham = new NottinghamVault(address(this), address(this), address(registry), 0);
        HolderRewardDistributor holders = new HolderRewardDistributor(address(this), address(this), address(registry));
        PlatformFeeReservoir reservoir = new PlatformFeeReservoir(address(this), address(registry));
        RovoFeeSplitter splitter = new RovoFeeSplitter(address(this), address(registry), address(nottingham), address(holders), address(reservoir), TREASURY);
        nottingham.setSplitter(address(splitter));
        holders.setSplitter(address(splitter));
        reservoir.setSplitter(address(splitter));
        MockNativeEscrow escrow = new MockNativeEscrow();
        LaunchFeeCollector collector = new LaunchFeeCollector();
        collector.initialize(bytes32(uint256(1)), address(0), address(escrow), address(splitter), address(this));
        address token = address(0x1111);
        collector.bindProfileToken(token);
        RovoTypes.Launch memory launch = _launch(token, address(0), address(collector), 77, "native", RovoTypes.LaunchType.SelfRove);
        launch.claimed = true;
        launch.creator = address(this);
        registry.registerLaunch(launch);
        escrow.fund{value: 10_000}(address(collector));
        UnprivilegedHarvester outsider = new UnprivilegedHarvester();
        require(!outsider.tryHarvest(splitter, token), "outsider harvest allowed");
        require(!outsider.tryHarvestBatch(splitter, token), "outsider batch allowed");
        (bool directCollect,) = address(collector).call(abi.encodeCall(collector.collect, ()));
        require(!directCollect, "direct collector bypass allowed");
        require(escrow.owed(address(collector)) == 10_000, "unauthorized call moved fees");
        require(splitter.harvest(token) == 10_000, "native collector");
        require(splitter.pending(address(0), address(this)) == 7_000, "native creator split");
        (uint256 funded,,) = holders.pools(token);
        require(funded == 2_000, "native holder split");
        require(reservoir.credited(address(0)) == 1_000, "native platform split");
        bytes32 root = keccak256(bytes.concat(keccak256(abi.encode(address(this), uint256(2_000)))));
        holders.setEpochRoot(token, 1, root, 2_000);
        holders.claim(token, 1, 2_000, new bytes32[](0));
        reservoir.grantRole(reservoir.EXECUTOR_ROLE(), address(this));
        reservoir.release(address(0), 1_000, address(this));
        splitter.withdraw(address(0));
        require(address(this).balance >= 10_000, "native payout total");
    }

    function testAdminBatchHarvestIsolatesFailedLaunch() external payable {
        require(msg.value == 10_000, "test funding");
        RovoRegistry registry = new RovoRegistry(address(this));
        registry.grantRole(registry.LAUNCHER_ROLE(), address(this));
        MockBucket nottingham = new MockBucket();
        MockBucket holders = new MockBucket();
        MockBucket reservoir = new MockBucket();
        RovoFeeSplitter splitter = new RovoFeeSplitter(address(this), address(registry), address(nottingham), address(holders), address(reservoir), TREASURY);
        MockNativeEscrow escrow = new MockNativeEscrow();
        LaunchFeeCollector collector = new LaunchFeeCollector();
        collector.initialize(bytes32(uint256(2)), address(0), address(escrow), address(splitter), address(this));
        address token = address(0x2222);
        collector.bindProfileToken(token);
        RovoTypes.Launch memory launch = _launch(token, address(0), address(collector), 78, "batch", RovoTypes.LaunchType.SelfRove);
        launch.claimed = true;
        launch.creator = address(this);
        registry.registerLaunch(launch);
        escrow.fund{value: 10_000}(address(collector));
        address[] memory tokens = new address[](2);
        tokens[0] = address(0xDEAD);
        tokens[1] = token;
        splitter.harvestBatch(tokens);
        require(escrow.owed(address(collector)) == 0, "batch did not harvest valid launch");
        require(splitter.pending(address(0), address(this)) == 7_000, "batch creator split");
        require(holders.credited(token, address(0)) == 2_000, "batch holder split");
        require(reservoir.credited(token, address(0)) == 1_000, "batch platform split");
    }

    function testNativeRevenueCanGoDirectlyToTreasury() external payable {
        require(msg.value == 10_000, "test funding");
        RovoRegistry registry = new RovoRegistry(address(this));
        registry.grantRole(registry.LAUNCHER_ROLE(), address(this));
        MockBucket nottingham = new MockBucket();
        MockBucket holders = new MockBucket();
        MockBucket reservoir = new MockBucket();
        RovoFeeSplitter splitter = new RovoFeeSplitter(
            address(this), address(registry), address(nottingham), address(holders), address(reservoir), TREASURY
        );
        MockNativeEscrow escrow = new MockNativeEscrow();
        LaunchFeeCollector collector = new LaunchFeeCollector();
        collector.initialize(bytes32(uint256(3)), address(0), address(escrow), address(splitter), address(this));
        address token = address(0x3333);
        collector.bindProfileToken(token);
        RovoTypes.Launch memory launch = _launch(token, address(0), address(collector), 79, "treasury-eth", RovoTypes.LaunchType.SelfRove);
        launch.claimed = true;
        launch.creator = address(this);
        registry.registerLaunch(launch);
        escrow.fund{value: 10_000}(address(collector));
        UnprivilegedHarvester outsider = new UnprivilegedHarvester();
        require(!outsider.tryTreasury(collector), "outsider treasury route allowed");
        require(escrow.owed(address(collector)) == 10_000, "outsider moved native fees");
        uint256 beforeTreasury = TREASURY.balance;
        require(collector.collectToTreasury() == 10_000, "native treasury collection");
        require(TREASURY.balance == beforeTreasury + 10_000, "native treasury amount");
        require(address(splitter).balance == 0, "native funds reached splitter");
        require(splitter.pending(address(0), address(this)) == 0, "native fees were split");
        require(holders.credited(token, address(0)) == 0 && reservoir.credited(token, address(0)) == 0, "native buckets funded");
        (bool repeat,) = address(collector).call(abi.encodeCall(collector.collectToTreasury, ()));
        require(!repeat, "native fees claimed twice");
    }

    function testUsdGRevenueCanGoDirectlyToTreasury() external {
        RovoRegistry registry = new RovoRegistry(address(this));
        MockBucket nottingham = new MockBucket();
        MockBucket holders = new MockBucket();
        MockBucket reservoir = new MockBucket();
        RovoFeeSplitter splitter = new RovoFeeSplitter(
            address(this), address(registry), address(nottingham), address(holders), address(reservoir), TREASURY
        );
        MockUsdG usdg = new MockUsdG();
        MockNativeEscrow escrow = new MockNativeEscrow();
        LaunchFeeCollector collector = new LaunchFeeCollector();
        collector.initialize(bytes32(uint256(4)), address(usdg), address(escrow), address(splitter), address(this));
        collector.bindProfileToken(address(0x4444));
        usdg.mint(address(this), 1_000_000);
        usdg.approve(address(escrow), 1_000_000);
        escrow.fundToken(address(collector), address(usdg), 1_000_000);
        require(collector.collectToTreasury() == 1_000_000, "USDG treasury collection");
        require(usdg.balanceOf(TREASURY) == 1_000_000, "USDG treasury amount");
        require(usdg.balanceOf(address(splitter)) == 0, "USDG funds reached splitter");
        require(escrow.tokenOwed(address(collector), address(usdg)) == 0, "USDG remains claimable");
    }

    function testZeroTreasuryRejected() external {
        try new RovoFeeSplitter(address(this), address(0x1001), address(0x1002), address(0x1003), address(0x1004), address(0)) {
            revert("zero treasury accepted");
        } catch {}
    }

    function testZapNativeQuoteRefundAndUsdGRegression() external payable {
        require(msg.value == 1_000, "test funding");
        _testZapQuote(address(0), 1_000);
        MockUsdG usdg = new MockUsdG();
        require(usdg.decimals() == 6, "USDG decimals");
        usdg.mint(address(this), 1_000);
        _testZapQuote(address(usdg), 0);
    }

    function testZapNativeV4QuoteRefund() external payable {
        require(msg.value == 1_000, "test funding");
        RovoRegistry registry = new RovoRegistry(address(this));
        registry.grantRole(registry.LAUNCHER_ROLE(), address(this));
        MockToken profile = new MockToken();
        MockPonsCurve curve = new MockPonsCurve(profile, address(0));
        MockPonsPhaseFactory factory = new MockPonsPhaseFactory(address(curve), address(0));
        factory.setPhase(2);
        RovoZapRouter zap = new RovoZapRouter(address(this), address(registry));
        MockNativeV4Adapter adapter = new MockNativeV4Adapter();
        RovoTypes.Launch memory launch = _launch(address(profile), address(0), address(0x1234), 77, "zap-v4", RovoTypes.LaunchType.SelfRove);
        launch.curve = address(curve);
        launch.ponsFactory = address(factory);
        registry.registerLaunch(launch);
        zap.setAdapter(address(adapter), true);
        zap.setV4Adapter(address(profile), address(adapter));
        uint256 beforeBalance = address(this).balance;
        uint256 output = zap.buyV4{value: 1_000}(
            address(profile), address(0), 1_000, 1_000, 500, block.timestamp + 60, address(0), "", ""
        );
        require(output == 500 && profile.balanceOf(address(this)) == 500, "v4 output");
        require(address(this).balance == beforeBalance - 500, "v4 native refund");
        require(address(zap).balance == 0, "v4 native residual");
    }

    function _testZapQuote(address pairToken, uint256 nativeValue) private {
        RovoRegistry registry = new RovoRegistry(address(this));
        registry.grantRole(registry.LAUNCHER_ROLE(), address(this));
        MockToken profile = new MockToken();
        MockPonsCurve curve = new MockPonsCurve(profile, pairToken);
        MockPonsPhaseFactory factory = new MockPonsPhaseFactory(address(curve), pairToken);
        RovoZapRouter zap = new RovoZapRouter(address(this), address(registry));
        RovoTypes.Launch memory launch = _launch(address(profile), pairToken, address(0x1234), 77, "zap", RovoTypes.LaunchType.SelfRove);
        launch.curve = address(curve);
        launch.ponsFactory = address(factory);
        registry.registerLaunch(launch);
        if (pairToken != address(0)) MockToken(pairToken).approve(address(zap), 1_000);
        uint256 beforeBalance = address(this).balance;
        uint256 output = zap.buyCurve{value: nativeValue}(
            address(profile), pairToken, 1_000, 1_000, 500, block.timestamp + 60, address(0), ""
        );
        require(output == 500 && profile.balanceOf(address(this)) == 500, "zap output");
        require(address(zap).balance == 0, "native refund stranded");
        if (pairToken == address(0)) {
            require(address(this).balance == beforeBalance - 500, "native refund");
        } else {
            require(MockToken(pairToken).balanceOf(address(this)) == 500, "erc20 unspent quote");
            require(MockToken(pairToken).balanceOf(address(zap)) == 0, "erc20 residual quote");
        }
        (bool success,) = address(zap).call{value: pairToken == address(0) ? 500 : 0}(
            abi.encodeCall(zap.buyCurve, (address(profile), pairToken, 500, 500, 251, block.timestamp + 60, address(0), ""))
        );
        require(!success, "minimum output bypassed");
        require(profile.balanceOf(address(this)) == 500, "failed buy minted tokens");
    }
    function testRegistryRejectsASecondTokenForTheSameXProfile() external {
        RovoRegistry registry = new RovoRegistry(address(this));
        registry.grantRole(registry.LAUNCHER_ROLE(), address(this));
        registry.registerLaunch(_launch(address(0x101), address(0x201), address(0x301), 42, "alice", RovoTypes.LaunchType.Scout));

        (bool success,) = address(registry).call(
            abi.encodeCall(
                registry.registerLaunch,
                (_launch(address(0x102), address(0x202), address(0x302), 42, "alice2", RovoTypes.LaunchType.Scout))
            )
        );
        require(!success, "duplicate X profile accepted");
    }

    function testRegistryRejectsASecondTokenForTheSameHandle() external {
        RovoRegistry registry = new RovoRegistry(address(this));
        registry.grantRole(registry.LAUNCHER_ROLE(), address(this));
        registry.registerLaunch(_launch(address(0x101), address(0x201), address(0x301), 42, "alice", RovoTypes.LaunchType.Scout));

        (bool success,) = address(registry).call(
            abi.encodeCall(
                registry.registerLaunch,
                (_launch(address(0x102), address(0x202), address(0x302), 43, "alice", RovoTypes.LaunchType.Scout))
            )
        );
        require(!success, "duplicate handle accepted");
    }

    function testSelfRoveSplitUsesTheFullCombinedRevenue() external {
        (RovoFeeSplitter splitter, MockToken stock, MockBucket nottingham, MockBucket holders, MockBucket reservoir, MockCollector collector, address token) =
            _system(RovoTypes.LaunchType.SelfRove, true);
        stock.mint(address(collector), 10_000);
        collector.disperse(splitter, token, stock, 10_000);

        require(splitter.pending(address(stock), address(0xCAFE)) == 7_000, "creator split");
        require(reservoir.credited(token, address(stock)) == 1_000, "platform split");
        require(holders.credited(token, address(stock)) == 2_000, "holder split");
        require(nottingham.credited(token, address(stock)) == 0, "vault split");
    }

    function testScoutSplitAndFundingInvariant() external {
        (RovoFeeSplitter splitter, MockToken stock, MockBucket nottingham, MockBucket holders, MockBucket reservoir, MockCollector collector, address token) =
            _system(RovoTypes.LaunchType.Scout, false);
        stock.mint(address(collector), 10_000);
        collector.disperse(splitter, token, stock, 10_000);

        require(splitter.pending(address(stock), address(0xBEEF)) == 1_500, "rover split");
        require(nottingham.credited(token, address(stock)) == 6_000, "vault split");
        require(reservoir.credited(token, address(stock)) == 1_000, "platform split");
        require(holders.credited(token, address(stock)) == 1_500, "holder split");

        (bool success,) = address(collector).call(
            abi.encodeCall(collector.disperseWithoutFunding, (splitter, token, stock, 10_000))
        );
        require(!success, "prior pending balance reused as new revenue");
    }

    function testFuzzSelfRoveAlwaysAccountsForEveryUnit(uint128 rawAmount) external {
        uint256 amount = uint256(rawAmount) + 1;
        (RovoFeeSplitter splitter, MockToken stock,, MockBucket holders, MockBucket reservoir, MockCollector collector, address token) =
            _system(RovoTypes.LaunchType.SelfRove, true);
        stock.mint(address(collector), amount);
        collector.disperse(splitter, token, stock, amount);
        uint256 total = splitter.pending(address(stock), address(0xCAFE))
            + holders.credited(token, address(stock))
            + reservoir.credited(token, address(stock));
        require(total == amount, "split lost value");
    }

    function _system(RovoTypes.LaunchType launchType, bool claimed)
        private
        returns (
            RovoFeeSplitter splitter,
            MockToken stock,
            MockBucket nottingham,
            MockBucket holders,
            MockBucket reservoir,
            MockCollector collector,
            address token
        )
    {
        RovoRegistry registry = new RovoRegistry(address(this));
        registry.grantRole(registry.LAUNCHER_ROLE(), address(this));
        stock = new MockToken();
        nottingham = new MockBucket();
        holders = new MockBucket();
        reservoir = new MockBucket();
        splitter = new RovoFeeSplitter(address(this), address(registry), address(nottingham), address(holders), address(reservoir), TREASURY);
        collector = new MockCollector();
        token = address(0x1111);
        RovoTypes.Launch memory launch = _launch(token, address(stock), address(collector), 77, "profile", launchType);
        launch.claimed = claimed;
        launch.creator = claimed ? address(0xCAFE) : address(0);
        launch.rover = launchType == RovoTypes.LaunchType.Scout ? address(0xBEEF) : address(0);
        registry.registerLaunch(launch);
    }

    function _launch(
        address token,
        address pairToken,
        address collector,
        uint64 xUserId,
        string memory handle,
        RovoTypes.LaunchType launchType
    ) private view returns (RovoTypes.Launch memory) {
        return RovoTypes.Launch({
            token: token,
            curve: address(0xC0DE),
            pairToken: pairToken,
            feeCollector: collector,
            ponsFactory: address(0x1001),
            ponsFeeEscrow: address(0x1002),
            ponsMemeHook: address(0x1003),
            handleHash: keccak256(bytes(handle)),
            expectedEconomics: bytes32(uint256(1)),
            xUserId: xUserId,
            rover: address(0),
            creator: address(0),
            launchedAt: uint64(block.timestamp),
            creatorTaxBps: 100,
            creatorToHoldersBps: 0,
            launchConfigId: 1,
            launchType: launchType,
            claimed: false,
            shareWithHolders: false
        });
    }
}
