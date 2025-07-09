class ApiSecurity {
  private static instance: ApiSecurity;

  private constructor() {}

  public static getInstance(): ApiSecurity {
    if (!ApiSecurity.instance) {
      ApiSecurity.instance = new ApiSecurity();
    }
    return ApiSecurity.instance;
  }

  public validateRequest = jest.fn();
  public checkApiAccess = jest.fn();
  public sanitizeInput = jest.fn();
}

export default ApiSecurity; 