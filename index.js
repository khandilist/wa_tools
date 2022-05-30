const express = require('express')
const path = require('path')
const fs = require('fs');
const app = express()
const port = 3333
//const port = 3000

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.get('/blast', (req, res) => {
  res.render('index', {
     title: 'Blast WA Tools',
  });
})

app.get('/register', (req, res) => {
  res.render('register', {
     title: 'Register WA Number',
  });
})

app.get('/upload', (req, res) => {
  res.render('upload', {
     title: 'Upload Images',
  });
})

app.get('/list_file', (req, res) => {
  let file_list = []
  fs.readdirSync('./static/images/', { withFileTypes: true }).filter(dirent => dirent.isFile()).forEach(file => {
    file_list.push(file.name);
  });
  res.render('list_file', {
     title: 'List Images',
     file_list: file_list,
  });
})

app.use(express.static(path.join(__dirname, 'static')));

app.use('/api/wa', require('./controllers/api_wa'));

// initialize wa status
fs.writeFileSync(path.resolve(__dirname) + '/controllers/wa.status', "0");

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`)
})
