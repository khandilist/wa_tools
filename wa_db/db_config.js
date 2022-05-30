var mysql = require('mysql');

var db = mysql.createConnection({
    host: "trukesid-mysql.ctyaaiuhrwdk.ap-southeast-1.rds.amazonaws.com",
    user: "akr",
    password: "akrakrakr",
    database: "trukesid",
    timezone: '+07:00',
});

module.exports = db;
