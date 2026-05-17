const Joi = require('joi');

const registerSchema = Joi.object({
  name: Joi.string().min(2).max(50).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required()
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required()
});

const forgotPasswordSchema = Joi.object({
  email: Joi.string().email().required()
});

const resetPasswordSchema = Joi.object({
  token: Joi.string().min(32).required(),
  password: Joi.string().min(6).required()
});

const expenseSchema = Joi.object({
  description: Joi.string().required(),
  amount: Joi.number().positive().required(),
  groupId: Joi.string().required(), // MongoDB ID
  paidBy: Joi.string(), // MongoDB ID
  paidByMultiple: Joi.array().items(Joi.object({
    user: Joi.string().required(),
    amount: Joi.number().required()
  })),
  members: Joi.array().items(Joi.string()).when('splitType', {
    is: 'equal',
    then: Joi.array().min(1).required(),
    otherwise: Joi.array().optional()
  }), // Used for 'equal' split
  splitType: Joi.string().valid('equal', 'percentage', 'exact').required(),
  splits: Joi.when('splitType', {
    is: 'equal',
    then: Joi.array().items(Joi.object({
      user: Joi.string().required(),
      amount: Joi.number(),
      percentage: Joi.number()
    })).default([]),
    otherwise: Joi.array().items(Joi.object({
      user: Joi.string().required(),
      amount: Joi.number(),
      percentage: Joi.number()
    })).min(1).required()
  }),
  date: Joi.date(),
  category: Joi.string()
});

module.exports = {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  expenseSchema
};
