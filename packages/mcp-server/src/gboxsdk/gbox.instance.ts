import { 
    GboxSDK,
    GboxClient,
    GboxClientError,
    APIError,
    APIConnectionError,
    APIConnectionTimeoutError,
    APIUserAbortError,
    NotFoundError,
    ConflictError,
    RateLimitError,
    BadRequestError,
    AuthenticationError,
    InternalServerError,
    PermissionDeniedError,
    UnprocessableEntityError, 
} from 'gbox-sdk'

const GBOX_BASE_URL = process.env.GBOX_URL || 'http://localhost:28080';

export const gbox = new GboxSDK({
    baseURL: GBOX_BASE_URL,
    apiKey: process.env.GBOX_API_KEY || '',
});

export const gboxClient = new GboxClient({
    baseURL: GBOX_BASE_URL,
    apiKey: process.env.GBOX_API_KEY || '',
});

export const FILE_SIZE_LIMITS = {
    TEXT: 1024 * 1024, // 1MB for text files
    BINARY: 5 * 1024 * 1024, // 5MB for binary files (images, audio)
} as const;

export {
    GboxClientError,
    APIError,
    APIConnectionError,
    APIConnectionTimeoutError,
    APIUserAbortError,
    NotFoundError,
    ConflictError,
    RateLimitError,
    BadRequestError,
    AuthenticationError,
    InternalServerError,
    PermissionDeniedError,
    UnprocessableEntityError,
}