import { preview } from '../../shared/preview';
// Short share links are complete HTML responses, including for anonymous preview bots.
export const onRequest = preview('certificate');
