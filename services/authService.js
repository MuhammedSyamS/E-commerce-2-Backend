const User = require('../models/User');
const { generateToken, generateRefreshToken } = require('../utils/generateToken');
const logger = require('../utils/logger');

class AuthService {
  async register(userData) {
    const { email } = userData;
    const userExists = await User.findOne({ email: email.toLowerCase() });
    
    if (userExists) {
      throw new Error('USER_ALREADY_EXISTS');
    }

    const user = await User.create(userData);
    
    return {
      user: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
      },
      accessToken: generateToken(user._id, user.tokenVersion),
      refreshToken: generateRefreshToken(user._id, user.tokenVersion),
    };
  }

  async login(email, password) {
    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user || !(await user.matchPassword(password))) {
      logger.warn(`[AUTH] [LOGIN_FAIL] ${email}`);
      throw new Error('INVALID_CREDENTIALS');
    }

    if (user.isBlocked) throw new Error('ACCOUNT_BLOCKED');
    if (user.isDeleted) throw new Error('ACCOUNT_DELETED');

    return {
      user: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
      },
      accessToken: generateToken(user._id, user.tokenVersion),
      refreshToken: generateRefreshToken(user._id, user.tokenVersion),
    };
  }
}

module.exports = new AuthService();
