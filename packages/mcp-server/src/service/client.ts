// --- Configuration --- 
import {
    GBoxClient,
    Box,
    GBoxFile, // Re-add File model import
    APIError,
} from '../../../sdk/typescript/src/index';

const GBOX_URL = process.env.GBOX_URL || 'http://localhost:28080';

const gbox = new GBoxClient({ baseURL: GBOX_URL });

export default gbox;