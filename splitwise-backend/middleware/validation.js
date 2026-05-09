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

const expenseSchema = Joi.object({
  description: Joi.string().required(),
  amount: Joi.number().positive().required(),
  groupId: Joi.string().required(), // MongoDB ID
  paidBy: Joi.string(), // MongoDB ID
  paidByMultiple: Joi.array().items(Joi.object({
    user: Joi.string().required(),
    amount: Joi.number().required()
  })),
  members: Joi.array().items(Joi.string()), // Used for 'equal' split
  splitType: Joi.string().valid('equal', 'percentage', 'exact').required(),
  splits: Joi.array().items(Joi.object({
    user: Joi.string().required(),
    amount: Joi.number(),
    percentage: Joi.number()
  })).min(1).required(),
  date: Joi.date(),
  category: Joi.string()
});

module.exports = {
  registerSchema,
  loginSchema,
  expenseSchema
};
