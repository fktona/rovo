import { Queue, Worker, type ConnectionOptions, type Processor } from "bullmq";

export const queueNames = {
  epochs: "rovo-epochs",
  buybacks: "rovo-buybacks",
  monitoring: "rovo-monitoring",
} as const;

export function createQueues(connection: ConnectionOptions) {
  return {
    epochs: new Queue(queueNames.epochs, { connection }),
    buybacks: new Queue(queueNames.buybacks, { connection }),
    monitoring: new Queue(queueNames.monitoring, { connection }),
  };
}

export type WorkerProcessors = {
  epochs: Processor;
  buybacks: Processor;
  monitoring: Processor;
};

export function createWorkers(
  connection: ConnectionOptions,
  processors: WorkerProcessors,
) {
  return [
    new Worker(queueNames.epochs, processors.epochs, { connection }),
    new Worker(queueNames.buybacks, processors.buybacks, { connection }),
    new Worker(queueNames.monitoring, processors.monitoring, { connection }),
  ];
}
