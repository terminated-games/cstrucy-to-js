const { Transform } = require('stream')
const BufferList = require('bl')

class Dissolve extends Transform {
  constructor(options = {}) {

    if (options.objectMode === undefined) {
      options.objectMode = true
    }

    super(options)

    this.vars = {}
    this.queue = []
    this.buffer = new BufferList()
  }

  _transform(chunk, encoding, resolve) {
    this.buffer.append(chunk)

    // console.log(this.buffer.length)

    // this.push({})
    // this.push(null)

    resolve()
  }
}



module.exports = Dissolve


let compiler = new Dissolve

compiler.loop(() => {
  compiler.s32('test').tap(() => {
    compiler.push(compiler.vars)
    compiler.vars = {}
  })
})

compiler.on('readable', () => {
  let result

  while (result = compiler.read()) {
    console.log('result:', result)
  }
})

compiler.on('end', () => {
  console.log('dissolve ended')
})

compiler.write(Buffer.alloc(4096))
compiler.write(Buffer.alloc(4096))
compiler.write(Buffer.alloc(4096))
compiler.write(Buffer.alloc(4096))
compiler.write(Buffer.alloc(4096))
compiler.write(Buffer.alloc(4096))
compiler.write(Buffer.alloc(4096))
compiler.write(Buffer.alloc(4096))
compiler.write(Buffer.alloc(4096))
compiler.write(Buffer.alloc(4096))