const { OAuth2Client } = require("google-auth-library");
const User = require("../models/User");
const generateToken = require("../utils/generateToken");

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

exports.googleLogin = async (req, res) => {
  try {
    const { token } = req.body;

    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID
    });

    const payload = ticket.getPayload();

    const email = payload.email;
    const firstName = payload.given_name;
    const lastName = payload.family_name;

    let user = await User.findOne({ email });

    if (!user) {
      user = await User.create({
        firstName,
        lastName,
        email,
        googleId: payload.sub
      });
    }

    res.json({
      _id: user._id,
      firstName: user.firstName,
      token: generateToken(user._id)
    });

  } catch (error) {
    console.error(error);
    res.status(401).json({ message: "Google login failed" });
  }
};