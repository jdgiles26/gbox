import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BoxManager } from '../../src/managers/boxManager.ts';
import { Box } from '../../src/models/box.ts';
import { BoxApi } from '../../src/api/boxApi.ts';
import type { BoxData, BoxListFilters, BoxCreateOptions, BoxesDeleteResponse, BoxReclaimResponse } from '../../src/types/box.ts';
import { NotFoundError } from '../../src/errors.ts';

// Mock BoxApi methods
const mockBoxApiList = vi.fn();
const mockBoxApiGetDetails = vi.fn();
const mockBoxApiCreate = vi.fn();
const mockBoxApiDeleteAll = vi.fn();
const mockBoxApiReclaim = vi.fn();

// Mock the BoxApi class
vi.mock('../../src/api/boxApi.ts', () => {
  return {
    BoxApi: vi.fn().mockImplementation(() => {
      return {
        list: mockBoxApiList,
        getDetails: mockBoxApiGetDetails,
        create: mockBoxApiCreate,
        deleteAll: mockBoxApiDeleteAll,
        reclaim: mockBoxApiReclaim,
        // Add other BoxApi methods used by Box model if necessary
      };
    })
  };
});

// Mock the Box model class
vi.mock('../../src/models/box.ts', () => {
  // Mock the constructor and any methods called by BoxManager if needed
  const BoxMock = vi.fn().mockImplementation((data: BoxData, api: BoxApi) => {
    return {
      // Simulate Box instance properties/methods if needed for tests
      ...data, // Include data for basic property checks
      _api: api, // Store api instance for verification
      // Mock methods like refresh, delete, start, stop etc. if BoxManager interacts with them
      // For now, just checking instantiation is enough
    };
  });
  return { Box: BoxMock };
});

describe('BoxManager', () => {
  let boxManager: BoxManager;
  let mockBoxApiInstance: BoxApi;

  beforeEach(() => {
    // Clear mocks before each test
    vi.clearAllMocks();
    mockBoxApiList.mockReset();
    mockBoxApiGetDetails.mockReset();
    mockBoxApiCreate.mockReset();
    mockBoxApiDeleteAll.mockReset();
    mockBoxApiReclaim.mockReset();
    (Box as any).mockClear(); // Clear Box constructor mock calls

    // Create a new instance of the mocked BoxApi for the manager
    // We don't need a real Axios instance here as BoxApi is fully mocked
    mockBoxApiInstance = new BoxApi({} as any, false); // Pass dummy args
    boxManager = new BoxManager(mockBoxApiInstance);
  });

  it('should be defined', () => {
    expect(boxManager).toBeDefined();
  });

  describe('list', () => {
    it('should list boxes and wrap them in Box models', async () => {
      const mockRawBoxes: BoxData[] = [
        { id: 'box1', status: 'running', image: 'img1' },
        { id: 'box2', status: 'stopped', image: 'img2' },
      ];
      mockBoxApiList.mockResolvedValue({ boxes: mockRawBoxes });

      const boxes = await boxManager.list();

      expect(mockBoxApiList).toHaveBeenCalledWith(undefined); // No filters
      expect(boxes).toHaveLength(2);
      expect(Box).toHaveBeenCalledTimes(2);
      expect(Box).toHaveBeenNthCalledWith(1, mockRawBoxes[0], mockBoxApiInstance);
      expect(Box).toHaveBeenNthCalledWith(2, mockRawBoxes[1], mockBoxApiInstance);
      // Optionally check properties of the returned (mocked) Box instances
      expect((boxes[0] as any).id).toBe('box1');
      expect((boxes[1] as any).id).toBe('box2');
    });

    it('should list boxes with filters', async () => {
      const filters: BoxListFilters = { label: ['env=prod'] };
      const mockRawBoxes: BoxData[] = [
        { id: 'box3', status: 'running', image: 'img3', labels: { 'env': 'prod' } },
      ];
      mockBoxApiList.mockResolvedValue({ boxes: mockRawBoxes });

      const boxes = await boxManager.list(filters);

      expect(mockBoxApiList).toHaveBeenCalledWith(filters);
      expect(boxes).toHaveLength(1);
      expect(Box).toHaveBeenCalledTimes(1);
      expect(Box).toHaveBeenCalledWith(mockRawBoxes[0], mockBoxApiInstance);
      expect((boxes[0] as any).id).toBe('box3');
    });
  });

  describe('get', () => {
    it('should get a specific box and wrap it in a Box model', async () => {
      const boxId = 'box123';
      const mockRawBox: BoxData = { id: boxId, status: 'running', image: 'img1' };
      mockBoxApiGetDetails.mockResolvedValue(mockRawBox);

      const box = await boxManager.get(boxId);

      expect(mockBoxApiGetDetails).toHaveBeenCalledWith(boxId);
      expect(Box).toHaveBeenCalledTimes(1);
      expect(Box).toHaveBeenCalledWith(mockRawBox, mockBoxApiInstance);
      expect((box as any).id).toBe(boxId);
    });

    it('should throw NotFoundError if boxApi.getDetails throws NotFoundError', async () => {
      const boxId = 'not-found';
      const error = new NotFoundError('Box not found');
      mockBoxApiGetDetails.mockRejectedValue(error);

      await expect(boxManager.get(boxId)).rejects.toThrow(NotFoundError);
      await expect(boxManager.get(boxId)).rejects.toThrow('Box not found');
      expect(mockBoxApiGetDetails).toHaveBeenCalledWith(boxId);
      expect(Box).not.toHaveBeenCalled();
    });
  });

  describe('create', () => {
    it('should create a box and wrap the response in a Box model', async () => {
      const options: BoxCreateOptions = { image: 'new-image', labels: { 'a': 'b' } };
      // Mock the response from boxApi.create (which is BoxData)
      const mockApiResponse: BoxData = { id: 'newBoxId', image: 'new-image', status: 'created', labels: { 'a': 'b' } };
      mockBoxApiCreate.mockResolvedValue(mockApiResponse);

      const box = await boxManager.create(options);

      expect(mockBoxApiCreate).toHaveBeenCalledWith(options);
      expect(Box).toHaveBeenCalledTimes(1);
      // The manager should pass the *entire response* from boxApi.create to the Box constructor
      expect(Box).toHaveBeenCalledWith(mockApiResponse, mockBoxApiInstance);
      expect((box as any).id).toBe('newBoxId');
    });
  });

  describe('deleteAll', () => {
    it('should call boxApi.deleteAll without force', async () => {
      const mockResponse: BoxesDeleteResponse = { count: 2, ids: ['id1', 'id2'], message: 'Deleted' };
      mockBoxApiDeleteAll.mockResolvedValue(mockResponse);

      const result = await boxManager.deleteAll(); // Default force is false

      expect(mockBoxApiDeleteAll).toHaveBeenCalledWith(false);
      expect(result).toEqual(mockResponse);
    });

    it('should call boxApi.deleteAll with force=true', async () => {
      const mockResponse: BoxesDeleteResponse = { count: 1, ids: ['id3'], message: 'Force deleted' };
      mockBoxApiDeleteAll.mockResolvedValue(mockResponse);

      const result = await boxManager.deleteAll(true);

      expect(mockBoxApiDeleteAll).toHaveBeenCalledWith(true);
      expect(result).toEqual(mockResponse);
    });
  });

  describe('reclaim', () => {
    it('should call boxApi.reclaim for all boxes without force', async () => {
      const mockResponse: BoxReclaimResponse = { deletedIds: ['id1'], message: 'Reclaimed' };
      mockBoxApiReclaim.mockResolvedValue(mockResponse);

      const result = await boxManager.reclaim(); // Default force is false

      // Should call reclaim with undefined boxId and force=false
      expect(mockBoxApiReclaim).toHaveBeenCalledWith(undefined, false);
      expect(result).toEqual(mockResponse);
    });

    it('should call boxApi.reclaim for all boxes with force=true', async () => {
      const mockResponse: BoxReclaimResponse = { deletedIds: ['id2'], message: 'Force reclaimed' };
      mockBoxApiReclaim.mockResolvedValue(mockResponse);

      const result = await boxManager.reclaim(true);

      // Should call reclaim with undefined boxId and force=true
      expect(mockBoxApiReclaim).toHaveBeenCalledWith(undefined, true);
      expect(result).toEqual(mockResponse);
    });
  });

}); 