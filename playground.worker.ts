import { handleComputeRequest, type ComputeReply, type ComputeRequest } from './playground-compute';

// Describe only the worker APIs we use, keeping DOM and worker global libs separate.
interface ComputeWorkerScope {
  onmessage: ((event: MessageEvent<ComputeRequest>) => void) | null;
  postMessage(reply: ComputeReply): void;
}
const scope = globalThis as unknown as ComputeWorkerScope;
scope.onmessage = ({ data }) => {
  scope.postMessage(handleComputeRequest(data));
};
