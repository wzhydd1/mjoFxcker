const fs = require("fs");
const iconv = require('iconv-lite');

class ByteBuffer {
    /**
     * @type {Buffer}
     */
    buffer;

    /**
     * @param {String|Buffer} source String : File path
     */
    constructor(source) {
        switch (typeof source) {
            case "string":
                try {
                    this.buffer = fs.readFileSync(source);
                } catch (e) {
                    console.error(e);
                    var msg = "read failed";
                    //alert(msg);
                    throw msg;
                }
                break;
            case "object":
                try {
                    this.buffer = Buffer.from(source);
                } catch (e) {
                    console.error(e);
                    var msg = "can not convert source to buffer";
                    //alert(msg);
                    throw msg;
                }
                break;
            default:
                var msg = "unknown source";
                //alert(msg)
                throw msg;
        }
    }
}

class XorTable extends ByteBuffer {

    /**
     * @type {Buffer}
     */
    table;

    constructor(file = "file/mjobj.xor") {
        super(file);
        var bufferArr = [];
        this.buffer.toString().split(/[ \r\n]/).forEach(function (value) {
            if (value == "") return;
            bufferArr.push(Number("0x" + value));
        });
        this.table = Buffer.from(bufferArr);
    }
}

class MajiroVMCode extends ByteBuffer {

    /**
     * @typedef {Object} VMCode
     * @property {Number} code
     * @property {CodeContent[]} contents 
     * 
     * @typedef {Object} CodeContent
     * @property {Number} length
     * @property {Boolean} isLengthInCode
     * @property {Buffer|String|Number} content
     */

    /**
     * @type {VMCode[]}
     */
    codeList = [];

    pointer = 0;

    /**
     * @param {Buffer} buffer 
     */
    constructor(buffer) {
        super(buffer);

        for (; this.pointer <= this.buffer.length - 2;) {
            let code = this.readUIntLE(2);
            this.codeList.push(this.readCode(code));
        }
    }

    /**
     * @param {VMCode} code
     */
    addCode(start, code) {
        this.codeList.splice(start, 0, code);
    }

    testCodePre(index, code) {
        return index > 0 ? this.codeList[index - 1].code == code : false;
    }

    /**
     * @param {Number} length 
     */
    readUIntLE(length) {
        var res = this.buffer.readUIntLE(this.pointer, length);
        this.pointer += length;
        return res;
    }

    /**
     * @param {Number} length 
     */
    readByte(length) {
        var res = this.buffer.slice(this.pointer, this.pointer + length);
        this.pointer += length;
        return res;
    }

    /**
     * @param {Number} length
     * @returns {CodeContent}
     */
    readVMCodeContent(length, isLengthInCode = false, isNumberContent = true, isEncoded = true) {
        return {
            length: length,
            isLengthInCode: isLengthInCode,
            content: isNumberContent ?
                this.readUIntLE(length) :
                isEncoded ?
                    iconv.decode(this.readByte(length), "shift_jis") :
                    //iconv.decode(this.readByte(length), "gbk") :
                    this.readByte(length)
        };
    }

    /**
     * @param {Number} code 
     */
    readCode(code) {
        /**
         * @type {VMCode}
         */
        var vmcode = {
            code: code,
            contents: []
        };
        switch (code) {
            case 0x800:
            case 0x803:
            case 0x82c:
            case 0x82d:
            case 0x82e:
            case 0x830:
            case 0x831:
            case 0x832:
            case 0x833:
            case 0x838:
            case 0x839:
            case 0x83b:
            case 0x83c:
            case 0x83d:
            case 0x843:
            case 0x845:
            case 0x847:
                vmcode.contents.push(
                    this.readVMCodeContent(4)
                );
                break;
            case 0x801:
            case 0x840:
            case 0x842:
                vmcode.contents.push(
                    this.readVMCodeContent(this.readUIntLE(2), true, false)
                );
                break;
            case 0x802:
                vmcode.contents.push(
                    this.readVMCodeContent(2),
                    this.readVMCodeContent(4),
                    this.readVMCodeContent(2)
                );
                break;
            case 0x80f:
            case 0x810:
                vmcode.contents.push(
                    this.readVMCodeContent(4),
                    this.readVMCodeContent(4),
                    this.readVMCodeContent(2)
                );
                break;
            case 0x829:
                vmcode.contents.push(
                    this.readVMCodeContent(this.readUIntLE(2), true, false, false)
                );
                break;
            case 0x834:
            case 0x835:
                vmcode.contents.push(
                    this.readVMCodeContent(4),
                    this.readVMCodeContent(2)
                )
                break;
            case 0x836:
                vmcode.contents.push(
                    this.readVMCodeContent(this.readUIntLE(2), true, false)
                );
                break;
            case 0x837:
                vmcode.contents.push(
                    this.readVMCodeContent(4),
                    this.readVMCodeContent(4)
                )
                break;
            case 0x83a:
                vmcode.contents.push(
                    this.readVMCodeContent(2)
                )
                break;
            case 0x850:
                var length = this.readUIntLE(2);
                vmcode.contents.push({
                    length: length,//trueLength=length*4
                    isLengthInCode: true,
                    content: this.readByte(length * 4)
                });
                break;
            case 0x82b:
            case 0x82f:
            case 0x83e:
            case 0x83f:
            case 0x841:
            case 0x844:
            case 0x846:
                break;
            default:
                if (code <= 0x1a9 && code >= 0x100) {
                    break;
                } else if (code >= 0x1b8 && code <= 0x200) {
                    vmcode.contents.push(
                        this.readVMCodeContent(2),
                        this.readVMCodeContent(4),
                        this.readVMCodeContent(2)
                    );
                    break;
                } else if (code >= 0x218 && code <= 0x260) {
                    vmcode.contents.push(
                        this.readVMCodeContent(2),
                        this.readVMCodeContent(4),
                        this.readVMCodeContent(2)
                    );
                    break;
                } else if (code >= 0x270 && code <= 0x2c0) {
                    vmcode.contents.push(
                        this.readVMCodeContent(2),
                        this.readVMCodeContent(4),
                        this.readVMCodeContent(2)
                    );
                    break;
                } else if (code >= 0x2d0 && code <= 0x320) {
                    vmcode.contents.push(
                        this.readVMCodeContent(2),
                        this.readVMCodeContent(4),
                        this.readVMCodeContent(2)
                    );
                    break;
                } else if (code <= 850) {
                    vmcode.contents.push(
                        this.readVMCodeContent(2),
                        this.readVMCodeContent(4),
                        this.readVMCodeContent(2)
                    );
                    break;
                } else {
                    console.error(this.codeList, `Unknow VMCode
offset : ${this.pointer}
code : ${code}`);
                    var msg = "unknow VMCode";
                    //alert(msg);
                    throw msg;
                }
        }
        return vmcode;
    }

    toBuffer() {
        /**
         * @type {Buffer[]}
         */
        var bufferList = [];
        for (const code of this.codeList) {
            let codeLength = Buffer.allocUnsafe(2);
            codeLength.writeUInt16LE(code.code, 0);
            bufferList.push(codeLength);
            for (const content of code.contents) {
                if (content.isLengthInCode) {
                    let contentLength = Buffer.allocUnsafe(2);
                    contentLength.writeUInt16LE(content.length, 0);
                    bufferList.push(contentLength);
                }
                switch (typeof content.content) {
                    case "number":
                        var numberContent = Buffer.allocUnsafe(content.length);
                        numberContent.writeUIntLE(content.content, 0, content.length);
                        bufferList.push(
                            numberContent
                        );
                        break;
                    case "string":
                        bufferList.push(
                            iconv.encode(content.content, "shift_jis")
                        );
                        break;
                    case "object":
                        bufferList.push(
                            content.content
                        );
                        break;
                    default:
                        var msg = "unknow content";
                        console.log(code);
                        //alert(msg);
                        throw msg;
                }
            }
        }
        return Buffer.concat(bufferList);
    }

    toVMCodeText() {
        var fileStr = "";
        for (const code of this.codeList) {
            fileStr += `0x${code.code.toString(16)}`;
            for (const content of code.contents) {
                fileStr += `\t${content.content}`;
            }
            fileStr += "\r\n";
        }
        return fileStr;
    }
}

class MajiroObj extends ByteBuffer {
    static magic = iconv.encode("MajiroObjX1.000\0", "gbk");
    static xorTable = new XorTable();

    /**
     * @type {String}
     */
    file;

    /**
     * @type {Number}
     */
    lineCount;

    /**
     * @type {Number}
     */
    entryCount;

    /**
     * @type {Number}
     */
    headerLength;

    /**
     * @type {MajiroVMCode}
     */
    vmcode;

    /**
     * @param {String} file
     */
    constructor(file) {
        super(file);
        if (this.buffer.slice(0, 0x10).compare(this.constructor.magic) != 0) {
            //alert("unknow format\n" + file);
            console.error("unknow format\n" + file, this.buffer.slice(0, 0x10));
            return;
        }
        this.file = file;
        this.lineCount = this.buffer.readUIntLE(0x14, 4);
        this.entryCount = this.buffer.readUIntLE(0x18, 4);
        this.headerLength = 0x20 + this.entryCount * 8;

        this.doXor();
        this.vmcode = new MajiroVMCode(this.buffer.slice(this.headerLength));
    }

    doXor() {
        this.buffer[9] ^= 0x17;
        for (let i = this.headerLength, j = 0; i < this.buffer.length; i++, j++) {
            this.buffer[i] ^= this.constructor.xorTable.table[j & 0x3ff];
        }
    }
}
