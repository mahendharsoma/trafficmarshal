import { handleTrafficMarshalController } from '../controllers/TrafficMarshalController';

export async function dispatchApiRequest(request) {
  return handleTrafficMarshalController(request);
}
