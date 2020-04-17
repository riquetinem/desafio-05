import { getConnection, getRepository } from 'typeorm';
import csvParse from 'csv-parse';
import fs from 'fs';
import path from 'path';

import uploadConfig from '../config/upload';

import Transaction from '../models/Transaction';
import Category from '../models/Category';

interface Request {
  fileName: string;
}

interface CsvTransaction {
  title: string;
  value: number;
  type: 'income' | 'outcome';
  category: string;
}

class ImportTransactionsService {
  async execute({ fileName }: Request): Promise<Transaction[]> {
    const transactionsRepository = getRepository(Transaction);
    const categoryRepository = getRepository(Category);

    // seta o caminho + nome do arquivo
    const csvFilePath = path.join(uploadConfig.directory, fileName);
    const csvReadStream = fs.createReadStream(csvFilePath);

    const parsers = csvParse({ delimiter: ', ', from_line: 2 });
    const parseCSV = csvReadStream.pipe(parsers);

    const transactionsCSV: CsvTransaction[] = [];

    parseCSV.on('data', async line => {
      const [title, type, value, category] = line;

      transactionsCSV.push({ title, type, value, category });
    });

    await new Promise(resolve => parseCSV.on('end', resolve));

    const categories = transactionsCSV
      .map(transection => transection.category)
      .filter((elem, pos, self) => {
        return self.indexOf(elem) === pos;
      })
      .map(category => categoryRepository.create({ title: category }));

    const transactions = transactionsCSV.map(transaction => {
      const category_id = categories.find(
        category => category.title === transaction.category,
      )?.id;

      return transactionsRepository.create({
        title: transaction.title,
        type: transaction.type,
        value: transaction.value,
        category_id,
      });
    });

    await getConnection()
      .createQueryBuilder()
      .insert()
      .into(Category)
      .values(categories)
      .execute();

    await getConnection()
      .createQueryBuilder()
      .insert()
      .into(Transaction)
      .values(transactions)
      .execute();

    await fs.promises.unlink(csvFilePath);

    return transactions;
  }
}

export default ImportTransactionsService;
