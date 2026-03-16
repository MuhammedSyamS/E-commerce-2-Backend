const { z } = require('zod');

const registerSchema = z.object({
  body: z.object({
    firstName: z.string().min(2, "First name must be at least 2 characters"),
    lastName: z.string().min(1, "Last name is required"),
    email: z.string().email("Invalid email address"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    phone: z.string().min(10, "Phone number must be at least 10 digits"),
    code: z.string().length(6, "OTP must be 6 digits"),
    referralCode: z.string().optional(),
  })
});

const loginSchema = z.object({
  body: z.object({
    email: z.string().email("Invalid email address"),
    password: z.string().min(1, "Password is required"),
  })
});

const productSchema = z.object({
  body: z.object({
    name: z.string().min(3, "Name must be at least 3 characters"),
    price: z.number().positive("Price must be positive"),
    category: z.string().min(1, "Category is required"),
    countInStock: z.number().int().nonnegative(),
    description: z.string().optional(),
  })
});

module.exports = { registerSchema, loginSchema, productSchema };
