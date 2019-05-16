const { Transform } = require('stream')

class Dissolve extends Transform {
  constructor() {
    super()

    this.vars = {}
    this.queue = []
  }

  _transform(chunk, encoding, resolve) {
    console.log(chunk)
  }

  tap() {

  }

  loop() {

  }
}

module.exports = Dissolve


let compiler = new Dissolve

compiler.on('readable', () => {
  let result

  while (result = compiler.read()) {
    console.log('result:', result)
  }
})

compiler.write(Buffer.alloc(100))