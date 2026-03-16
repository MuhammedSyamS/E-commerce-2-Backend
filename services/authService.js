const User = require('../models/User');
const generateToken = require('../utils/generateToken');
const logger = require('../utils/logger');

/**
 * AuthService handles business logic for user authentication
 */
class AuthService {
  async register(userData) {
    const { email } = userData;
    const userExists = await User.findOne({ email: email.toLowerCase() });
    
    if (userExists) {
      throw new Error('USER ALREADY REGISTERED');
    }

    const user = await User.create(userData);
    
    return {
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      token: generateToken(user._id),
    };
  }

  async login(email, password) {
    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user || !(await user.matchPassword(password))) {
      logger.warn(`[AUTH] [LOGIN FAIL] Invalid credentials for: ${email}`);
      throw new Error('INVALID EMAIL OR PASSWORD');
    }

    return {
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      token: generateToken(user._id),
    };
  }
}

module.exports = new AuthService();
