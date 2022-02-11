import { Response } from 'paperback-extensions-common'

import json from './external/sanfrancisco18.json'

const letterHeight = json.height

const BMP_HEADER1 = [0x42, 0x4D]
// insert 4 bytes of file size here, little-endian, 54 bytes header + img data size
const BMP_HEADER2 = [0x00, 0x00, 0x00, 0x00, 0x36, 0x00, 0x00, 0x00, 0x28, 0x00, 0x00, 0x00]
// insert 4 bytes of pixel width, 4 bytes of pixel height, little-endian
const BMP_HEADER3 = [0x01, 0x00, 0x18, 0x00, 0x00, 0x00, 0x00, 0x00]
// insert 4 bytes of image data size, 4 bytes of width res in px/mtr, 4 bytes of height res in px/mtr, little-endian
const BMP_HEADER4 = [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]
// insert image data here, little-endian (B-G-R), ensure all lines end in a 4-byte multiple

function writeImageData(data: number[][][]): Uint8Array {
    let imgdata: number[] = []
    const width = data[0]!.length
    const bytewidth = Math.ceil(data[0]!.length*3/4)*4
    const height = data.length
    const size = bytewidth*height
    const filesize = size+54
    for(let i = data.length - 1; i >= 0; i--) { // bitmaps write bottom to top, left to right for whatever reason
        for(let j = 0; j < data[0]!.length; j++) {
            imgdata.push(...data[i]![j]!)
        }
        for(let j = data[0]!.length*3; j < bytewidth; j++) {
            imgdata.push(0x00)
        }
    }
    return Uint8Array.from([...BMP_HEADER1, ...littleEndianify(4, filesize), ...BMP_HEADER2, ...littleEndianify(4, width), ...littleEndianify(4, height), ...BMP_HEADER3, ...littleEndianify(4, size), 0x13, 0x0b, 0x00, 0x00, 0x13, 0x0b, 0x00, 0x00, ...BMP_HEADER4, ...imgdata])
}

 function littleEndianify(size: number, data: number): number[] {
    const arr = []
    for(let i = 0; i < size; i++) {
        arr.push((data >> (i*8) & 0x000000ff))
    }
    return arr
}

function calculateTextLength(text: string): number {
    let n = 0
    for(let c of text.split("")) {
        n += c.charCodeAt(0)-32 >= 0 && c.charCodeAt(0)-32 <= 95 ? json.font[c.charCodeAt(0)-32]!.length/letterHeight : json.font[0]!.length/letterHeight
    }
    return n
}

export function spliterate(text: string, max: number): {split: string[], width: number} {
    text = text.replace(/\n/g, "\n ")
    const fullsplit = text.split(" ")
    const split: string[] = []
    let base = 0
    let maxlen = 0
    let prevlen = 0
    let curlen = 0
    for(let i = 0; i <= fullsplit.length; i++) {
        prevlen = curlen
        curlen = calculateTextLength(fullsplit.slice(base, i+1).join(" "))
        if(curlen > max || fullsplit[i-1]?.includes("\n")) {
            split.push(fullsplit.slice(base, i).join(" ").replace(/\n/g, ""))
            if(prevlen > maxlen) maxlen = prevlen 
            base = i
        }
    }
    split.push(fullsplit.slice(base, fullsplit.length).join(" "))
    if(curlen > maxlen) maxlen = curlen
    return {split: split, width: maxlen}
}

function writeText(text: string, maxLineLength: number, padding: number, lines: number, page: number, constantWidth: boolean): number[][][] {
    text = text.replace(/[^\x00-\x7F]/g, "")
    let {split, width} = spliterate(text, maxLineLength-padding*2)
    split = split.slice((page-1)*lines, page*lines > split.length ? undefined : page*lines)
    width += padding*2
    if(constantWidth) width = maxLineLength
    const height = split.length*letterHeight + padding*2
    let img: number[][][] = []
    let lineAt = -1
    for(let i = 0; i < height; i++) {
        img[i] = []
        if(i < padding || i >= height-padding) {
            for(let j = 0; j < width; j++) {
                img[i]![j] = [0xff, 0xff, 0xff]
            }
            continue
        }
        if((i-padding)%letterHeight==0) {
            lineAt++
        }
        let letterOn = -1
        let letter: number[] = []
        let letterBase = padding
        for(let j = 0; j < width; j++) {
            if(j < padding || j >= width-padding) {
                img[i]![j] = [0xff, 0xff, 0xff]
                continue
            }
            if(j >= letterBase + letter.length/letterHeight) {
                letterOn++
                letterBase = j
                let char = split[lineAt]!.charCodeAt(letterOn)-32
                if(Number.isNaN(char) || char < 0 || char >= 95 || char === undefined) char = 0
                letter = json.font[char]!
            }
            const color: number = letter[((i-padding)-lineAt*letterHeight)*(letter.length/letterHeight)+j-letterBase]!
            img[i]![j] = [color, color, color]
        }
    }
    return img
}





export function interceptResponse(response: Response, cheerio: any): Response {
    if((response.request.url.includes('ttiparse') || response.request.param?.includes('ttiparse')) && (response.request.url.includes('ttipage') || response.request.param?.includes('ttipage'))) {
        let pageNum = 1
        if(response.request.url.includes('ttipage')) {
            for(let param of response.request.url.split("?")[1]!.split("&")) {
                if(param.includes("ttipage") && !Number.isNaN(parseInt(param.split("=")[1]!))) pageNum = parseInt(param.split("=")[1]!)
            }
        }
        else if(response.request.param?.includes('ttipage')) {
            for(let param of response.request.param!.split("&")) {
                if(param.includes("ttipage") && !Number.isNaN(parseInt(param.split("=")[1]!))) pageNum = parseInt(param.split("=")[1]!)
            }
        }
        const $ = cheerio.load(response.data)
        const arr = $('div.txt > p').toArray()
        const tarr: string[] = []
        for(let i of arr) {
            tarr.push($(i).text().replace(/&#x.{2};/g, ""))
        }
        let pageText = tarr.join("\n")
        response.rawData = createRawData(writeImageData(writeText(pageText, 800, 20, 60, pageNum, true)))
        response.headers['content-type'] = 'image/bmp'
    }
    return response
}
