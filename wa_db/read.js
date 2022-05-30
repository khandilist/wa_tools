const connection = require("./db_config");
const Promise = require('bluebird');

var queryAsync = Promise.promisify(connection.query.bind(connection));
connection.connect();

function read() {
    let sql = "SELECT * FROM wa_blast_record";
    queryAsync(sql).then(function(results) {
	// gunakan perulangan untuk menampilkan data
	console.log(`ID \t SENDER \t RECEIVER \t MESSAGE \t STATUS \t CREATE_TIME`);
	console.log(`--------------------------------------------------------------------------------------------------------------------`);
	results.forEach(record => {
	    console.log(`${record.id} \t ${record.sender} \t ${record.receiver} \t ${record.message} \t ${record.status} \t ${record.create_time}`);
	});
    });
}

read();
