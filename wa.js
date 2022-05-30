const venom = require('venom-bot');

var http = require('http');

http.createServer(function (req, res) {
  res.writeHead(200, {'Content-Type': 'text/html'});
  //Return the url part of the request object:
  res.write(req.url);
  res.end();
  console.log(req.url);

  if (req.url == '/call_wa') {
     console.log('prepare to call WA');
     callWA();
  }
}).listen(8080);


function callWA() {
  venom
  .create()
  .then((client) => bulkSend(client))
  .catch((erro) => {
    console.log(erro);
  });
}

async function bulkSend(client) {
  try {
     await sendImage(client, '6282217455308@c.us');
     await sendImage(client, '628118432189@c.us');
   } catch (error) {
      console.log(error);
   }
}

async function sendImage(client, to) {
  image_path = './img.jpg';
  image_name = 'img_thumb.jpg';
  image_caption = 'Image with caption Natasya unsaved list';

  await client
  .sendImage(
    to,
    image_path,
    image_name,
    image_caption
  )
  .then((result) => {
    console.log('Result: ', result); //return object success
  })
  .catch((erro) => {
    console.error('Error when sending: ', erro); //return object error
  });
}
