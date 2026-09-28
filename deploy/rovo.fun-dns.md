# rovo.fun DNS for Cloud Run

Add these records in GoDaddy for `rovo.fun`. Nameservers are `ns61.domaincontrol.com` and `ns62.domaincontrol.com`.

When this is done:

- `rovo.fun` and `www.rovo.fun` serve the web app
- `api.rovo.fun` serves the API

## Add

| Type | Host | Value |
| --- | --- | --- |
| TXT | `@` | `google-site-verification=ee6ztR0QIrEKZWvixNTOkj_ujQOh3r54IFR3j_GhjA8` |
| A | `@` | `216.239.32.21` |
| A | `@` | `216.239.34.21` |
| A | `@` | `216.239.36.21` |
| A | `@` | `216.239.38.21` |
| AAAA | `@` | `2001:4860:4802:32::15` |
| AAAA | `@` | `2001:4860:4802:34::15` |
| AAAA | `@` | `2001:4860:4802:36::15` |
| AAAA | `@` | `2001:4860:4802:38::15` |
| CNAME | `api` | `ghs.googlehosted.com` |
| CNAME | `www` | `ghs.googlehosted.com` |

`@` means the root domain `rovo.fun`. In GoDaddy, enter the CNAME targets as `ghs.googlehosted.com` (no trailing dot).

## Remove

These conflict with the new records:

- Apex A record `216.198.79.1`
- `www` CNAME `0bc85a961a247270.vercel-dns-017.com`

## Leave unchanged

Zoho mail stays as it is:

- TXT `v=spf1 include:dc-8e814c8572._spfm.rovo.fun ~all`
- TXT `zoho-verification=zb10611315.zmverify.zoho.com`
- MX `10 mx.zoho.com`
- MX `20 mx2.zoho.com`
- MX `50 mx3.zoho.com`

Reply when the records are saved.
