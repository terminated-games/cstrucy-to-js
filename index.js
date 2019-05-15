const fs = require('fs')
const Lexer = require('lex')
const Path = require('path')
const uuid = require('uuid')
const formatter = require('js-beautify')

const TYPE = {
  STRUCT: 0,
  MEMBER: 1,
  END: 2,
  INCLUDE: 3,
  SWITCH: 4,
  SWITCH_CASE: 5,
  SWITCH_BREAK: 6,
  SWITCH_DEFAULT: 7,
  RETURN: 8,
  WHITESPACE: 9,
  COMMENT: 10,
  MULTICOMMENT: 11,
  DEFINE: 12,
  NULL: 13
}

// TODO: Implement a cursor support for error reporting
const CURSOR = {
  col: 0,
  row: 0
}

let Parser = new Lexer((exception) => {
  throw new Error(exception)
})

Parser.addRule(/\r\n|\n|\r/, (match) => {
  // return {
  //   type: TYPE.RETURN
  // }
})

Parser.addRule(/ /, (match) => {
  // return {
  //   type: TYPE.WHITESPACE
  // }
})

Parser.addRule(/#include\s+\"([a-zA-Z0-9_]+)\"\s+([a-zA-Z_\-0-9\/\\@\.]+)/, (match, name, path) => {
  return {
    type: TYPE.INCLUDE,
    name: name,
    path: path
  }
})

Parser.addRule(/switch\s+\(([a-zA-Z0-9_\.\[\]]+)\)\s+\{/, (match, switch_argument) => {
  return {
    type: TYPE.SWITCH,
    argument: switch_argument
  }
})

Parser.addRule(/case\s+([a-zA-Z\.0-9_]+)\s*\:/, (match, switch_case) => {
  return {
    type: TYPE.SWITCH_CASE,
    case: switch_case
  }
})

Parser.addRule(/break\s*\;/, (match) => {
  return {
    type: TYPE.SWITCH_BREAK
  }
})

Parser.addRule(/default\s*\:/, (match) => {
  return {
    type: TYPE.SWITCH_DEFAULT
  }
})

Parser.addRule(/\}\s*\;/, (match) => {
  return {
    type: TYPE.END
  }
})

Parser.addRule(/struct\s+([a-zA-Z0-9_]+)\s+([a-zA-Z0-9_\[\]]+)\s*\;/, (match, name, member) => {
  return {
    type: TYPE.MEMBER,
    member_type: 'struct',
    struct: name,
    member: member
  }
})

Parser.addRule(/struct\s+([a-zA-Z0-9_]+)\s+\{/, (match, name) => {
  return {
    type: TYPE.STRUCT,
    name: name
  }
})

Parser.addRule(/([a-zA-Z0-9]+)\s+([a-zA-Z0-9_\[\]]+)\;/, (match, type, member) => {
  return {
    type: TYPE.MEMBER,
    member_type: type,
    member: member
  }
})

Parser.addRule(/#define\s+([a-zA-Z0-9_\.]+)\s+\=\s+(.*)/, (match, variable, expression) => {
  return {
    type: TYPE.DEFINE,
    variable,
    expression
  }
})

Parser.addRule(/\/\s*\*([\s\S]+)\*\s*\//, (match, comment) => {
  return {
    type: TYPE.MULTICOMMENT,
    comment: comment
  }
})

Parser.addRule(/\/\/\s+(.*)/, (match, comment) => {
  return {
    type: TYPE.COMMENT,
    comment: comment
  }
})

async function file(file_path) {
  return new Promise((resolve, reject) => {
    fs.readFile(file_path, 'utf-8', (exception, result) => {
      if (exception) return reject(exception)
      resolve(result)
    })
  })
}

async function dump(file_path, content) {
  return new Promise((resolve, reject) => {
    fs.writeFile(file_path, content, (exception) => {
      if (exception) return reject(exception)

      resolve()
    })
  })
}

const ENDL = '\r\n'

const ACTION_TYPE = {
  NULL: 0,
  STRUCT: 1,
  SWITCH: 2
}

class Member {
  constructor(type, member, struct = null) {
    this.result = {
      pack: '',
      unpack: ''
    }

    this.member = this.parse(member)

    this.type = type
    this.struct = struct

    this.function = this.type

    this.complement = ''
    this.endian = ''

    switch (this.type) {
      case 'int':
      this.function = `${this.complement}int32${this.endian}`
      break

      case 'short':
      this.function = `${this.complement}int16${this.endian}`
      break

      case 'char':
      this.function = `${this.complement}int8${this.endian}`
      break
    }

    if (this.member.arrays.length) {
      this.result.pack += `.pack(${JSON.stringify(this.member.arrays)}, this.${this.function}, data.${this.member.name}, ${struct ? "'" + struct + "'" : null})${ENDL}`
    } else {
      this.result.pack += `.${this.function}(data.${this.member.name})${ENDL}`
      this.result.unpack += `.${this.function}('${this.member.name}')${ENDL}`
    }
  }

  parse(member) {
    let arrays = []

    let [name] = member.match(/([a-zA-Z0-9_]+)/)
    let match = member.match(/\[([0-9]+)\]/)

    while (match) {
      let result = match[1]

      arrays.push(parseInt(result))

      member = member.substr(match.index +result.toString().length)
      match = member.match(/\[([0-9]+)\]/)
    }

    return {
      name,
      arrays
    }
  }

  pack() {
    return this.result.pack
  }

  unpack() {
    return this.result.unpack
  }
}

module.exports = (file_path, save = true) => {
  let o = {}

  o.header = ''
  o.module = ''
  o.struct = {
    pack: '',
    unpack: '',
    begin: true,
    has: {
      member: false
    },
    type: TYPE.NULL,
    data_required: false
  }
  o.result = null

  return Promise.resolve((async () => {

    Parser.input = await file(file_path)

    let path = Path.parse(file_path) // File info

    let result
    while (result = Parser.lex()) {
      switch (result.type) {

        case TYPE.INCLUDE:
        o.header += `const ${ result.name } = require('${ result.path }')${ENDL}`
        break
        
        case TYPE.STRUCT:
        o.struct.type = TYPE.STRUCT
        
        o.result = uuid.v4()
        o.struct.begin = true
        o.struct.has.member = false

        o.module += `
        module.exports.${result.name} = {
          pack: async function pack_${result.name}(data = {}) {
            ${o.result}
            return this
          },
          unpack: async function unpack_${result.name}() {
            ${o.result}
            return this
          },
          size: null
        }
        `
        break

        case TYPE.END:
        switch (o.struct.type) {

          case TYPE.STRUCT:
          o.module = o.module.replace(o.result, o.struct.pack)
          o.module = o.module.replace(o.result, o.struct.unpack)
          
          o.struct.pack = ''
          o.struct.unpack = ''
          break

          case TYPE.SWITCH:
          o.struct.type = TYPE.STRUCT

          o.struct.pack += `}${ENDL}`
          o.struct.unpack += `}${ENDL}})${ENDL}`
          break
        }

        o.struct.begin = true
        break

        case TYPE.MEMBER:
        if (o.struct.begin) {
          o.struct.pack += `this`
          o.struct.unpack += `this`
          o.struct.begin = false
        }

        let member = new Member(result.member_type, result.member, result.struct)

        o.struct.pack += member.pack()
        o.struct.unpack += member.unpack()

        o.struct.has.member = true
        break

        case TYPE.SWITCH:
        o.struct.type = TYPE.SWITCH

        o.struct.pack += `switch (${result.argument}) {${ENDL}`
        o.struct.unpack += `${o.struct.begin ? 'this' : ''}.tap(() => {
          let data = this.vars
          console.log('data:', data)
          switch (${result.argument}) {${ENDL}`
        o.struct.begin = !o.struct.begin
        break

        case TYPE.SWITCH_CASE:
        o.struct.pack += `case ${result.case}:${ENDL}`
        o.struct.unpack += `case ${result.case}:${ENDL}`
        o.struct.begin = true
        break

        case TYPE.SWITCH_BREAK:
        o.struct.pack += `break;${ENDL}`
        o.struct.unpack += `break;${ENDL}`
        break

        case TYPE.SWITCH_DEFAULT:
        o.struct.pack += `default:${ENDL}`
        o.struct.unpack += `default:${ENDL}`
        o.struct.begin = true
        break

        case TYPE.DEFINE:

        o.struct.unpack += `
        if ( ${result.variable} === undefined ) { ${result.variable} = ${result.expression} }${ENDL}
        `

        if (o.struct.has.member) {
          o.struct.begin = true
        }
        break
      }

      previous = result
    }

    let output_path = Path.join(path.dir, path.name + '.js')

    if (save) {
      await dump(output_path, formatter(o.header + ENDL + o.module), { indent_size: 2, space_in_empty_paren: true })
    }

    return output_path
  })())
}