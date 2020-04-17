import { getRepository, getCustomRepository } from 'typeorm';

import AppError from '../errors/AppError';

import Transaction from '../models/Transaction';
import Category from '../models/Category';

import TransactionRepository from '../repositories/TransactionsRepository';

interface Request {
  title: string;
  value: number;
  type: 'income' | 'outcome';
  title_category: string;
  category_id: string;
}

class CreateTransactionService {
  public async execute({
    title,
    value,
    type,
    title_category,
    category_id = '',
  }: Request): Promise<Transaction> {
    if (type !== 'income' && type !== 'outcome') {
      throw new AppError('Only INCOME or OUTCOME types are accepted', 404);
    }

    const transactionRepository = getCustomRepository(TransactionRepository);

    const balance = await transactionRepository.getBalance();

    if (type === 'outcome' && balance.income < balance.outcome + value) {
      throw new AppError('Your income is less than your outcome');
    }

    const categoryRepository = getRepository(Category);
    const categoryExist = await categoryRepository.findOne({
      where: { title: title_category },
    });

    const transaction = {
      title,
      type,
      value,
      category_id,
    };

    if (categoryExist) {
      transaction.category_id = categoryExist.id;
    } else {
      const newCategory = { title: title_category };

      const category = await categoryRepository.save(newCategory);

      transaction.category_id = category.id;
    }

    const newTransaction = transactionRepository.save(transaction);

    return newTransaction;
  }
}

export default CreateTransactionService;
