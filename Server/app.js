const express = require('express');
const bodyParser = require('body-parser');
const { Pool } = require('pg');
const moment = require('moment');
const {join} = require("node:path");

const app = express();
app.use(bodyParser.json());




app.use(express.static(join(__dirname, '/../Client/index/')));
app.use(express.static(join(__dirname, '/../node_modules/')));
console.log(join(__dirname, '../Client/public'))

app.set('view engine', 'ejs');
app.set('views', join(__dirname, '/../Client/'));


const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'storage',
    password: 'postgres',
    port: 5432,
});


app.get('/', (req, res) => {
    res.render('index/index.ejs', {body: ""});

});


// Проверка подключения к БД
pool.connect((err) => {
    if (err) {
        console.error('Cannot connect to DB:', err);
    } else {
        console.log('Connected to DB');
    }
});

// Утилиты
const clearExpiredOrders = async () => {
    const today = moment().format('YYYY-MM-DD');
    await pool.query('DELETE FROM Orders WHERE order_date < $1', [today]);
};

const replenishStock = async () => {
    const products = await pool.query('SELECT * FROM Products');
    for (const product of products.rows) {
        const randomIncrease = Math.floor(Math.random() * 10) + 1;
        await pool.query('UPDATE Products SET stock_quantity = stock_quantity + $1 WHERE product_id = $2', [
            randomIncrease,
            product.product_id,
        ]);
    }
};

// Очистка истекших заказов при запуске
app.use(async (req, res, next) => {
    await clearExpiredOrders();
    next();
});


// Создание нового заказа
app.post('/new_order', async (req, res) => {
    const { customer_name, order_date } = req.body;
    if (!customer_name || !order_date) {
        return res.status(400).json({ error: 'Необходимо указать имя заказчика и дату заказа' });
    }
    if (moment(order_date).isBefore(moment())) {
        return res.status(400).json({ error: 'Дата заказа не может быть меньше текущей' });
    }

    let orderId = "ORD010"
    await pool.query('INSERT INTO Orders (order_id, customer_id, order_date) VALUES ($1, $2, $3)', [
        orderId,
        customer_name,
        order_date,
    ]);
    res.status(201).json({ message: 'Заказ создан', order_id: orderId });
});

// Добавление позиций в заказ
app.post('/orders/:orderId/items', async (req, res) => {
    const { orderId } = req.params;
    const { product_id, quantity } = req.body;

    // Проверка наличия товара на складе
    const product = await pool.query('SELECT * FROM Products WHERE product_id = $1', [product_id]);
    if (!product.rows.length) {
        return res.status(404).json({ error: 'Товар не найден' });
    }
    if (product.rows[0].stock_quantity < quantity) {
        return res.status(400).json({ error: 'Недостаточно товара на складе' });
    }

    // Списание товара со склада
    await pool.query('UPDATE Products SET stock_quantity = stock_quantity - $1 WHERE product_id = $2', [
        quantity,
        product_id,
    ]);

    // Добавление позиции в заказ
    const orderItemId = uuidv4();
    await pool.query(
        'INSERT INTO order_items (order_item_id, order_id, product_id, quantity) VALUES ($1, $2, $3, $4)',
        [orderItemId, orderId, product_id, quantity]
    );

    res.status(201).json({ message: 'Позиция добавлена в заказ', order_item_id: orderItemId });

});

// Удаление позиции из заказа
app.delete('/orders/:orderId/items/:orderItemId', async (req, res) => {
    const { orderId, orderItemId } = req.params;

    // Увеличение количества товара на складе
    const orderItem = await pool.query('SELECT * FROM order_items WHERE order_item_id = $1', [orderItemId]);
    if (!orderItem.rows.length) {
        return res.status(404).json({ error: 'Позиция заказа не найдена' });
    }

    await pool.query('UPDATE Products SET stock_quantity = stock_quantity + $1 WHERE product_id = $2', [
        orderItem.rows[0].quantity,
        orderItem.rows[0].product_id,
    ]);

    // Удаление позиции из заказа
    await pool.query('DELETE FROM order_items WHERE order_item_id = $1 AND order_id = $2', [orderItemId, orderId]);
    res.status(200).json({ message: 'Позиция удалена из заказа' });
});



// Переключение текущей даты на следующий день
app.post('/next-day', async (req, res) => {
    const today = moment().format('YYYY-MM-DD');

    // Удаление заказов на текущий день
    const orders = await pool.query('SELECT * FROM Orders WHERE order_date = $1', [today]);
    for (const order of orders.rows) {
        // Списание товаров на складе
        const order_items = await pool.query('SELECT * FROM order_items WHERE order_id = $1', [order.order_id]);
        for (const item of order_items.rows) {
            await pool.query('DELETE FROM order_items WHERE order_item_id = $1', [item.order_item_id]);
        }
    }
    await pool.query('DELETE FROM Orders WHERE order_date = $1', [today]);

    // Пополнение склада
    await replenishStock();

    res.status(200).json({ message: 'День переключен, остатки обновлены' });
});

// Получение списка всех заказов
app.get('/orders', async (req, res) => {
    const orders = await pool.query('SELECT * FROM Orders');


    const schemaRus = ["ID заказа", "ID заказчика", "Дата заказа"]
    const schema = []
    orders.fields.forEach(field => {
        schema.push(field.name);
    })

    orders.rows.forEach(row => {
        row.order_date = moment(row.order_date).locale('ru').format('LL');
    })


    res.render('db_result/db_result.ejs', {
        schemaName: "Заказы",
        schema: schema,
        result: orders.rows,
        schemaRus: schemaRus
    });

});

app.get('/products', async (req, res) => {
    const products = await pool.query('SELECT * FROM products');


    const schemaRus = ["ID товара", "Наименование товара", "Количество на складе"]
    const schema = []
    products.fields.forEach(field => {
        schema.push(field.name);
    })

    res.render('db_result/db_result.ejs', {
        schemaName: "Остатки на складе",
        schema: schema,
        result: products.rows,
        schemaRus: schemaRus
    });

});

app.get('/customers', async (req, res) => {
    const customers = await pool.query(
        'SELECT * FROM customers'
    );


    const schemaRus = ["ID заказчика", "Имя заказчика"]
    const schema = []
    customers.fields.forEach(field => {
        schema.push(field.name);
    })

    res.render('db_result/db_result.ejs', {
        schemaName: "Заказчики",
        schema: schema,
        result: customers.rows,
        schemaRus: schemaRus
    });

});




// Запуск сервера
const PORT = 8080;
app.listen(PORT, () => {
    console.log(`Сервер запущен на http://localhost:${PORT}`);
});
