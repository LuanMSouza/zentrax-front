// Gerador mínimo de planilha .xlsx (Excel, Google Planilhas, LibreOffice), sem biblioteca.
// Um .xlsx é um .zip com alguns XMLs dentro.
//
// Loja grande (100k notas) travava o servidor ~40 s e deixava o processo com quase 2 GB de RAM: a versão antiga
// montava a planilha inteira numa string, zipava sem compressão e calculava o CRC em JavaScript puro. Agora:
//   - as linhas chegam aos poucos (AsyncIterable, a rota busca do banco em lotes);
//   - o XML vira texto de 1000 em 1000 linhas e vai direto pro compressor do Node (zlib, roda fora do JavaScript);
//   - o CRC também é do zlib (zlib.crc32, Node >= 20.15) e, entre um lote e outro, o servidor atende os outros.
// Só o arquivo já comprimido (uns 10% do tamanho) fica na memória.
import zlib from 'node:zlib'
import { once } from 'node:events'
import { setImmediate as proximaVolta } from 'node:timers/promises'

export type Celula = string | number | null | undefined | { data: Date | string | null } | { dinheiro: number | null }

export type Aba = {
    nome: string
    colunas: { titulo: string, largura?: number }[]
    linhas: Iterable<Celula[]> | AsyncIterable<Celula[]>
}

// ---------- XML ----------

function escaparXml(texto: string) {
    return texto
        // caractere de controle quebra o XML (e o Excel recusa abrir o arquivo inteiro)
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// A1, B1, ..., Z1, AA1
function nomeColuna(i: number) {
    let nome = ''
    for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) nome = String.fromCharCode(65 + ((n - 1) % 26)) + nome
    return nome
}

// Excel conta datas em dias desde 30/12/1899
function serialData(valor: Date | string) {
    const ms = new Date(valor).getTime()
    return ms / 86_400_000 + 25569
}

// estilos (índices de cellXfs em ESTILOS): 0 normal, 1 data, 2 dinheiro, 3 cabeçalho em negrito
function xmlCelula(c: Celula, ref: string) {
    if (c == null || c === '') return ''
    if (typeof c === 'number') return Number.isFinite(c) ? `<c r="${ref}"><v>${c}</v></c>` : ''
    if (typeof c === 'string') return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${escaparXml(c)}</t></is></c>`
    if ('data' in c) {
        if (!c.data || isNaN(new Date(c.data).getTime())) return ''
        return `<c r="${ref}" s="1"><v>${serialData(c.data)}</v></c>`
    }
    if (c.dinheiro == null || !Number.isFinite(c.dinheiro)) return ''
    return `<c r="${ref}" s="2"><v>${c.dinheiro}</v></c>`
}

const LINHAS_POR_LOTE = 1000

// XML da aba em pedaços (cabeçalho, lotes de linhas, rodapé). O autoFilter precisa da última linha, por isso vem
// no fim (é o lugar dele no XML mesmo).
async function* xmlAba(aba: Aba): AsyncGenerator<string> {
    const larguras = aba.colunas.map((col, i) => `<col min="${i + 1}" max="${i + 1}" width="${col.largura ?? 14}" customWidth="1"/>`).join('')
    const cabecalho = `<row r="1">${aba.colunas.map((col, i) =>
        `<c r="${nomeColuna(i)}1" t="inlineStr" s="3"><is><t>${escaparXml(col.titulo)}</t></is></c>`).join('')}</row>`
    yield `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
<cols>${larguras}</cols>
<sheetData>${cabecalho}`

    const letras = aba.colunas.map((_, i) => nomeColuna(i))
    let r = 1
    let lote: string[] = []
    for await (const linha of aba.linhas) {
        r++
        lote.push(`<row r="${r}">${linha.map((c, i) => xmlCelula(c, `${letras[i] ?? nomeColuna(i)}${r}`)).join('')}</row>`)
        if (lote.length >= LINHAS_POR_LOTE) {
            yield lote.join('')
            lote = []
            await proximaVolta() // deixa o servidor responder os outros clientes entre um lote e outro
        }
    }
    if (lote.length) yield lote.join('')

    const ultima = `${nomeColuna(Math.max(aba.colunas.length - 1, 0))}${r}`
    yield `</sheetData>
<autoFilter ref="A1:${ultima}"/>
</worksheet>`
}

const ESTILOS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="1"><numFmt numFmtId="164" formatCode="&quot;R$&quot; #,##0.00"/></numFmts>
<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>
<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="4">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="14" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
</cellXfs>
</styleSheet>`

type Arquivo = [string, string | AsyncIterable<string>]

function arquivosDaPlanilha(abas: Aba[]): Arquivo[] {
    // nome de aba: até 31 caracteres e sem : \ / ? * [ ]
    const nomes = abas.map(a => a.nome.replace(/[:\\/?*[\]]/g, ' ').slice(0, 31))
    return [
        ['[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
${abas.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('\n')}
</Types>`],
        ['_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`],
        ['xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets>${nomes.map((nome, i) => `<sheet name="${escaparXml(nome)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets>
</workbook>`],
        ['xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${abas.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('\n')}
<Relationship Id="rId${abas.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`],
        ['xl/styles.xml', ESTILOS],
        ...abas.map((aba, i): Arquivo => [`xl/worksheets/sheet${i + 1}.xml`, xmlAba(aba)]),
    ]
}

// ---------- ZIP (deflate) ----------

type Comprimido = { dados: Buffer, crc: number, tamanho: number }

// comprime o conteúdo (texto inteiro ou em pedaços) com deflate "cru", que é o que o zip usa (método 8)
async function comprimir(conteudo: string | AsyncIterable<string>): Promise<Comprimido> {
    const deflate = zlib.createDeflateRaw({ level: 6 })
    const saida: Buffer[] = []
    deflate.on('data', (b: Buffer) => saida.push(b))
    const terminou = once(deflate, 'end')

    let crc = 0
    let tamanho = 0
    const pedacos = typeof conteudo === 'string' ? [conteudo] : conteudo
    for await (const texto of pedacos) {
        const buf = Buffer.from(texto, 'utf8')
        crc = zlib.crc32(buf, crc)
        tamanho += buf.length
        if (!deflate.write(buf)) await once(deflate, 'drain')
    }
    deflate.end()
    await terminou
    return { dados: Buffer.concat(saida), crc: crc >>> 0, tamanho }
}

async function zipar(arquivos: Arquivo[]) {
    const partes: Buffer[] = []
    const central: Buffer[] = []
    let deslocamento = 0

    for (const [nome, conteudo] of arquivos) {
        const nomeBuf = Buffer.from(nome, 'utf8')
        const { dados, crc, tamanho } = await comprimir(conteudo)

        const local = Buffer.alloc(30)
        local.writeUInt32LE(0x04034b50, 0)
        local.writeUInt16LE(20, 4)        // versão necessária
        local.writeUInt16LE(0x0800, 6)    // nomes em UTF-8
        local.writeUInt16LE(8, 8)         // método 8 = deflate
        local.writeUInt32LE(0, 10)        // hora/data (zerado)
        local.writeUInt32LE(crc, 14)
        local.writeUInt32LE(dados.length, 18) // tamanho comprimido
        local.writeUInt32LE(tamanho, 22)      // tamanho original
        local.writeUInt16LE(nomeBuf.length, 26)
        local.writeUInt16LE(0, 28)
        partes.push(local, nomeBuf, dados)

        const cab = Buffer.alloc(46)
        cab.writeUInt32LE(0x02014b50, 0)
        cab.writeUInt16LE(20, 4)
        cab.writeUInt16LE(20, 6)
        cab.writeUInt16LE(0x0800, 8)
        cab.writeUInt16LE(8, 10)
        cab.writeUInt32LE(0, 12)
        cab.writeUInt32LE(crc, 16)
        cab.writeUInt32LE(dados.length, 20)
        cab.writeUInt32LE(tamanho, 24)
        cab.writeUInt16LE(nomeBuf.length, 28)
        cab.writeUInt32LE(deslocamento, 42)
        central.push(cab, nomeBuf)

        deslocamento += local.length + nomeBuf.length + dados.length
    }

    const tamanhoCentral = central.reduce((acc, b) => acc + b.length, 0)
    const fim = Buffer.alloc(22)
    fim.writeUInt32LE(0x06054b50, 0)
    fim.writeUInt16LE(arquivos.length, 8)
    fim.writeUInt16LE(arquivos.length, 10)
    fim.writeUInt32LE(tamanhoCentral, 12)
    fim.writeUInt32LE(deslocamento, 16)

    return Buffer.concat([...partes, ...central, fim])
}

export async function gerarXlsx(abas: Aba[]): Promise<Buffer> {
    return zipar(arquivosDaPlanilha(abas))
}
