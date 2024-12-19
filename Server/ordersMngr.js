const express = require('express');
const {Pool} = require('pg')
const {query} = require("express");

const router = express.Router();



const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'storage',
    password: 'postgres',
    port: 5432,
});





router.get('/', (req, res) => {
    try {
        const  result = pool.query(`SELECT * FROM Orders`);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
})
