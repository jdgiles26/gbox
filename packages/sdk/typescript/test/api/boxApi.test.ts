import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AxiosInstance, AxiosResponse, AxiosError } from 'axios';
import { BoxApi } from '../../src/api/boxApi.ts';
import type { BoxCreateOptions, BoxListFilters, BoxData, BoxListResponse, BoxGetResponse, BoxCreateResponse, BoxesDeleteResponse, BoxRunResponse, BoxReclaimResponse, BoxExtractArchiveResponse } from '../../src/types/box.ts';
import { GBoxError, APIError, NotFoundError } from '../../src/errors.ts';

// --- Mocks for AxiosInstance methods ---
// These will mock the *response* of the http client calls
const mockRequest = vi.fn();
const mockHeadRequest = vi.fn(); // Separate mock for head responses

// --- Mocks for the *calls* made by BoxApi methods ---
// These don't need to be mocks themselves anymore, but keep names for clarity in expects
// We will assert based on the calls made to mockRequest and mockHeadRequest
const mockGet = (...args: any[]) => mockRequest({ method: 'get', url: args[0], params: args[1], headers: args[2], responseType: 'json' });
const mockPost = (...args: any[]) => mockRequest({ method: 'post', url: args[0], data: args[1], params: args[2], headers: args[3], responseType: 'json' });
const mockDelete = (...args: any[]) => mockRequest({ method: 'delete', url: args[0], data: args[1], params: args[2], headers: args[3], responseType: 'json' });
const mockGetRaw = (...args: any[]) => mockRequest({ method: 'get', url: args[0], params: args[1], headers: args[2], responseType: 'arraybuffer' });
const mockPutRaw = (...args: any[]) => mockRequest({ method: 'put', url: args[0], data: args[1], params: args[2], headers: args[3], responseType: 'json' }); // Assuming response is json
const mockHead = (...args: any[]) => mockHeadRequest({ method: 'head', url: args[0], params: args[1], headers: args[2] });

describe('BoxApi', () => {
  let boxApi: BoxApi;
  let mockAxiosInstance: AxiosInstance;

  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();
    mockRequest.mockReset();
    mockHeadRequest.mockReset();

    // Create a minimal mock AxiosInstance with required methods
    mockAxiosInstance = {
      request: mockRequest,
      head: mockHeadRequest,
      // Add other properties minimally required by the Client constructor or usage
      defaults: { headers: {} } as any,
      interceptors: { request: { use: vi.fn(), eject: vi.fn() }, response: { use: vi.fn(), eject: vi.fn() } } as any,
    } as unknown as AxiosInstance; // Force type cast

    // Instantiate BoxApi with the mock AxiosInstance and disable logging for tests
    boxApi = new BoxApi(mockAxiosInstance, false);
  });

  it('should be defined', () => {
    expect(boxApi).toBeDefined();
  });

  describe('list', () => {
    it('should list boxes without filters', async () => {
      const mockData = { boxes: [{ id: 'box1', image: 'img1', status: 'running' } as BoxData] };
      const mockResponse: Partial<AxiosResponse> = { data: mockData }; // Axios wraps data
      mockRequest.mockResolvedValue(mockResponse);

      const result = await boxApi.list();

      // Assert that axiosInstance.request was called correctly by client.get
      expect(mockRequest).toHaveBeenCalledWith({ method: 'get', url: '/api/v1/boxes', params: {}, headers: undefined, responseType: 'json' });
      expect(result).toEqual(mockData); // Result should be the unwrapped data
    });

    it('should list boxes with label filters', async () => {
      const filters: BoxListFilters = { label: ['status=running', 'image=img1'] };
      const mockData = { boxes: [{ id: 'box1', image: 'img1', status: 'running' } as BoxData] };
      const mockResponse: Partial<AxiosResponse> = { data: mockData };
      mockRequest.mockResolvedValue(mockResponse);

      const result = await boxApi.list(filters);

      const expectedParams = { filter: ['label=status=running', 'label=image=img1'] };
      expect(mockRequest).toHaveBeenCalledWith({ method: 'get', url: '/api/v1/boxes', params: expectedParams, headers: undefined, responseType: 'json' });
      expect(result).toEqual(mockData);
    });

    it('should handle array id filters correctly', async () => {
        const filters: BoxListFilters = { id: ['box1', 'box2'] };
        const mockData = { boxes: [{ id: 'box1' , status: 'stopped'} as BoxData, { id: 'box2', status: 'running' } as BoxData] };
        const mockResponse: Partial<AxiosResponse> = { data: mockData };
        mockRequest.mockResolvedValue(mockResponse);

        const result = await boxApi.list(filters);

        const expectedParams = { filter: ['id=box1', 'id=box2'] };
        expect(mockRequest).toHaveBeenCalledWith({ method: 'get', url: '/api/v1/boxes', params: expectedParams, headers: undefined, responseType: 'json' });
        expect(result).toEqual(mockData);
    });

    it('should map extra_labels to labels', async () => {
      // API response simulation (data wrapped by Axios)
      const mockApiResponseData = {
        boxes: [{ id: 'box1', image: 'img1', status: 'running', extra_labels: { 'user': 'test' } }],
      };
      const mockResponse: Partial<AxiosResponse> = { data: mockApiResponseData };
      mockRequest.mockResolvedValue(mockResponse);

      // Expected final result after SDK processing
      const expectedResult: BoxListResponse = {
        boxes: [{ id: 'box1', image: 'img1', status: 'running', labels: { 'user': 'test' } } as BoxData],
      };

      const result = await boxApi.list();

      expect(mockRequest).toHaveBeenCalledWith({ method: 'get', url: '/api/v1/boxes', params: {}, headers: undefined, responseType: 'json' });
      expect(result).toEqual(expectedResult);
    });
  });

  describe('getDetails', () => {
    it('should get box details and map labels', async () => {
      const boxId = 'box123';
      const mockApiResponseData = { id: boxId, image: 'img1', status: 'running', extra_labels: { 'a': 'b' } };
      const mockResponse: Partial<AxiosResponse> = { data: mockApiResponseData };
      mockRequest.mockResolvedValue(mockResponse);

      const expectedResult: BoxGetResponse = { id: boxId, image: 'img1', status: 'running', labels: { 'a': 'b' } };

      const result = await boxApi.getDetails(boxId);

      expect(mockRequest).toHaveBeenCalledWith({ method: 'get', url: `/api/v1/boxes/${boxId}`, params: undefined, headers: undefined, responseType: 'json' });
      expect(result).toEqual(expectedResult);
    });
  });

  describe('create', () => {
    it('should create a box and map response labels', async () => {
      const options: BoxCreateOptions = { image: 'test-image', labels: { 'user': 'creator' } };
      const apiPayload = { image: 'test-image', extra_labels: { 'user': 'creator' } }; // Payload sent to API
      const mockApiResponseData = { id: 'newBox', image: 'test-image', status: 'created', extra_labels: { 'user': 'creator' } }; // Raw API response data
      const mockResponse: Partial<AxiosResponse> = { data: mockApiResponseData };
      mockRequest.mockResolvedValue(mockResponse);

      const expectedResult: BoxCreateResponse = { id: 'newBox', image: 'test-image', status: 'created', labels: { 'user': 'creator' } }; // Final SDK result

      const result = await boxApi.create(options);

      expect(mockRequest).toHaveBeenCalledWith({ method: 'post', url: '/api/v1/boxes', data: apiPayload, params: undefined, headers: undefined, responseType: 'json' });
      expect(result).toEqual(expectedResult);
    });

     it('should pass imagePullSecret and workingDir if provided', async () => {
      const options: BoxCreateOptions = {
        image: 'test-image',
        imagePullSecret: 'secret-name',
        workingDir: '/app'
      };
      const apiPayload = {
        image: 'test-image',
        imagePullSecret: 'secret-name',
        workingDir: '/app'
      };
      const mockApiResponseData = { id: 'newBox', image: 'test-image', status: 'created' };
      const mockResponse: Partial<AxiosResponse> = { data: mockApiResponseData };
      mockRequest.mockResolvedValue(mockResponse);

      const expectedResult: BoxCreateResponse = { id: 'newBox', image: 'test-image', status: 'created' };

      const result = await boxApi.create(options);

      expect(mockRequest).toHaveBeenCalledWith({ method: 'post', url: '/api/v1/boxes', data: apiPayload, params: undefined, headers: undefined, responseType: 'json' });
      expect(result).toEqual(expectedResult);
    });
  });

  describe('deleteBox', () => {
    it('should delete a specific box', async () => {
      const boxId = 'box123';
      const mockData = { message: 'Box deleted' };
      const mockResponse: Partial<AxiosResponse> = { data: mockData };
      mockRequest.mockResolvedValue(mockResponse);

      const result = await boxApi.deleteBox(boxId);

      expect(mockRequest).toHaveBeenCalledWith({ method: 'delete', url: `/api/v1/boxes/${boxId}`, data: undefined, params: undefined, headers: undefined, responseType: 'json' });
      expect(result).toEqual(mockData);
    });

    it('should delete a specific box with force', async () => {
      const boxId = 'box123';
      const mockData = { message: 'Box deleted forcefully' };
      const mockResponse: Partial<AxiosResponse> = { data: mockData };
      mockRequest.mockResolvedValue(mockResponse);

      const result = await boxApi.deleteBox(boxId, true);

      expect(mockRequest).toHaveBeenCalledWith({ method: 'delete', url: `/api/v1/boxes/${boxId}`, data: { force: true }, params: undefined, headers: undefined, responseType: 'json' });
      expect(result).toEqual(mockData);
    });
  });

  describe('deleteAll', () => {
    it('should delete all boxes', async () => {
      const mockData: BoxesDeleteResponse = { count: 2, ids: ['box1', 'box2'], message: 'All boxes deleted' };
      const mockResponse: Partial<AxiosResponse> = { data: mockData };
      mockRequest.mockResolvedValue(mockResponse);

      const result = await boxApi.deleteAll();

      expect(mockRequest).toHaveBeenCalledWith({ method: 'delete', url: '/api/v1/boxes', data: undefined, params: undefined, headers: undefined, responseType: 'json' });
      expect(result).toEqual(mockData);
    });

    it('should delete all boxes with force', async () => {
      const mockData: BoxesDeleteResponse = { count: 2, ids: ['box1', 'box2'], message: 'All boxes deleted forcefully' };
      const mockResponse: Partial<AxiosResponse> = { data: mockData };
      mockRequest.mockResolvedValue(mockResponse);

      const result = await boxApi.deleteAll(true);

      expect(mockRequest).toHaveBeenCalledWith({ method: 'delete', url: '/api/v1/boxes', data: { force: true }, params: undefined, headers: undefined, responseType: 'json' });
      expect(result).toEqual(mockData);
    });
  });

  describe('start', () => {
    it('should start a box', async () => {
      const boxId = 'box123';
      const mockData = { success: true, message: 'Box started' };
      const mockResponse: Partial<AxiosResponse> = { data: mockData };
      mockRequest.mockResolvedValue(mockResponse);

      const result = await boxApi.start(boxId);

      expect(mockRequest).toHaveBeenCalledWith({ method: 'post', url: `/api/v1/boxes/${boxId}/start`, data: {}, params: undefined, headers: undefined, responseType: 'json' });
      expect(result).toEqual(mockData);
    });
  });

  describe('stop', () => {
    it('should stop a box', async () => {
      const boxId = 'box123';
      const mockData = { success: true, message: 'Box stopped' };
      const mockResponse: Partial<AxiosResponse> = { data: mockData };
      mockRequest.mockResolvedValue(mockResponse);

      const result = await boxApi.stop(boxId);

      expect(mockRequest).toHaveBeenCalledWith({ method: 'post', url: `/api/v1/boxes/${boxId}/stop`, data: {}, params: undefined, headers: undefined, responseType: 'json' });
      expect(result).toEqual(mockData);
    });
  });

  describe('run', () => {
    it('should run a command and map response box labels', async () => {
      const boxId = 'box123';
      const command = ['echo', 'hello'];
      const apiPayload = { cmd: command };
      const mockApiResponseData = {
        stdout: 'hello\n',
        stderr: '',
        exitCode: 0,
        box: { id: boxId, image: 'img1', status: 'running', extra_labels: { 'run': 'test' } }
      };
      const mockResponse: Partial<AxiosResponse> = { data: mockApiResponseData };
      mockRequest.mockResolvedValue(mockResponse);

      const expectedResult: BoxRunResponse = {
        stdout: 'hello\n',
        stderr: '',
        exitCode: 0,
        box: { id: boxId, image: 'img1', status: 'running', labels: { 'run': 'test' } } as BoxData
      };

      const result = await boxApi.run(boxId, command);

      expect(mockRequest).toHaveBeenCalledWith({ method: 'post', url: `/api/v1/boxes/${boxId}/run`, data: apiPayload, params: undefined, headers: undefined, responseType: 'json' });
      expect(result).toEqual(expectedResult);
    });

    it('should run command without box in response', async () => {
        const boxId = 'box123';
        const command = ['ls'];
        const apiPayload = { cmd: command };
        const mockApiResponseData = { // API might not return box if not modified
            stdout: '.',
            stderr: '',
            exitCode: 0,
        };
        const mockResponse: Partial<AxiosResponse> = { data: mockApiResponseData };
        mockRequest.mockResolvedValue(mockResponse);

        const expectedResult: BoxRunResponse = { stdout: '.', stderr: '', exitCode: 0 };

        const result = await boxApi.run(boxId, command);

        expect(mockRequest).toHaveBeenCalledWith({ method: 'post', url: `/api/v1/boxes/${boxId}/run`, data: apiPayload, params: undefined, headers: undefined, responseType: 'json' });
        expect(result).toEqual(expectedResult);
    });
  });

  describe('reclaim', () => {
    it('should reclaim a specific box', async () => {
      const boxId = 'box123';
      const mockData: BoxReclaimResponse = { deletedIds: [boxId], message: 'Box reclaimed' };
      const mockResponse: Partial<AxiosResponse> = { data: mockData };
      mockRequest.mockResolvedValue(mockResponse);

      const result = await boxApi.reclaim(boxId);

      expect(mockRequest).toHaveBeenCalledWith({ method: 'post', url: `/api/v1/boxes/${boxId}/reclaim`, data: { force: false }, params: undefined, headers: undefined, responseType: 'json' });
      expect(result).toEqual(mockData);
    });

    it('should reclaim all inactive boxes with force', async () => {
      const mockData: BoxReclaimResponse = { deletedIds: ['box1', 'box2'], message: 'Inactive boxes reclaimed forcefully' };
      const mockResponse: Partial<AxiosResponse> = { data: mockData };
      mockRequest.mockResolvedValue(mockResponse);

      const result = await boxApi.reclaim(undefined, true);

      expect(mockRequest).toHaveBeenCalledWith({ method: 'post', url: '/api/v1/boxes/reclaim', data: { force: true }, params: undefined, headers: undefined, responseType: 'json' });
      expect(result).toEqual(mockData);
    });
  });

  describe('getArchive', () => {
    it('should get an archive from a box', async () => {
      const boxId = 'box123';
      const path = '/data/archive.tar';
      const mockData = new ArrayBuffer(10);
      const mockResponse: Partial<AxiosResponse> = { data: mockData }; // Raw data
      const expectedHeaders = { 'Accept': 'application/x-tar' };
      mockRequest.mockResolvedValue(mockResponse);

      const result = await boxApi.getArchive(boxId, path);

      expect(mockRequest).toHaveBeenCalledWith({
        method: 'get',
        url: `/api/v1/boxes/${boxId}/archive`,
        params: { path },
        headers: expectedHeaders,
        responseType: 'arraybuffer' // Crucial for getRaw
      });
      expect(result).toBeInstanceOf(ArrayBuffer);
      expect(result.byteLength).toBe(10);
    });
  });

  describe('extractArchive', () => {
    it('should extract an archive to a box', async () => {
      const boxId = 'box123';
      const path = '/target';
      const archiveData = new ArrayBuffer(20);
      const mockData: BoxExtractArchiveResponse = { message: 'Archive extracted successfully' };
      const mockResponse: Partial<AxiosResponse> = { data: mockData };
      const expectedHeaders = { 'Content-Type': 'application/x-tar' };
      mockRequest.mockResolvedValue(mockResponse);

      const result = await boxApi.extractArchive(boxId, path, archiveData);

      expect(mockRequest).toHaveBeenCalledWith({
        method: 'put',
        url: `/api/v1/boxes/${boxId}/archive`,
        data: archiveData,
        params: { path },
        headers: expectedHeaders,
        responseType: 'json' // Assuming response is JSON
      });
      expect(result).toEqual(mockData);
    });
  });

  describe('headArchive', () => {
    it('should get archive metadata', async () => {
      const boxId = 'box123';
      const path = '/data/some_file';
      const mockResponseHeaders = { 'content-type': 'application/octet-stream', 'content-length': '1024' };
      const mockResponse: Partial<AxiosResponse> = { headers: mockResponseHeaders, status: 200, statusText: 'OK', config: {} as any, data: '' };
      mockHeadRequest.mockResolvedValue(mockResponse);

      const result = await boxApi.headArchive(boxId, path);

      expect(mockHeadRequest).toHaveBeenCalledWith(
        `/api/v1/boxes/${boxId}/archive`,
        { params: { path }, headers: undefined }
      );
      expect(result).toEqual(mockResponseHeaders);
    });
  });

   // Example Error Handling Test
  describe('error handling', () => {
      it('should throw NotFoundError for 404 on getDetails', async () => {
          const boxId = 'nonexistent';
          const error = {
              isAxiosError: true,
              response: { status: 404, data: { message: 'Box not found' } },
              message: 'Request failed with status code 404'
          } as AxiosError;
          mockRequest.mockRejectedValue(error);

          await expect(boxApi.getDetails(boxId)).rejects.toThrow(NotFoundError);
          await expect(boxApi.getDetails(boxId)).rejects.toThrow('Box not found');
      });

      it('should throw APIError for other 4xx/5xx errors', async () => {
          const boxId = 'box123';
          const error = {
              isAxiosError: true,
              response: { status: 500, data: { message: 'Internal server error' } },
              message: 'Request failed with status code 500'
          } as AxiosError;
          mockRequest.mockRejectedValue(error);

          await expect(boxApi.start(boxId)).rejects.toThrow(APIError);
          await expect(boxApi.start(boxId)).rejects.toThrow('Internal server error');
          try {
              await boxApi.start(boxId);
          } catch (e) {
              expect((e as APIError).statusCode).toBe(500);
              expect((e as APIError).responseData).toEqual({ message: 'Internal server error' });
          }
      });

       it('should throw GBoxError for non-Axios errors', async () => {
          const boxId = 'box123';
          const error = new Error('Network fail');
          // Ensure the mock rejects with a non-Axios error
          mockRequest.mockImplementation(() => Promise.reject(error));

          await expect(boxApi.list()).rejects.toThrow(GBoxError);
          await expect(boxApi.list()).rejects.toThrow('An unexpected error occurred: Network fail');
      });
  });

}); 