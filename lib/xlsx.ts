// Gerador mínimo de planilha .xlsx (Excel, Google Planilhas, LibreOffice), sem biblioteca.
// Um .xlsx é um .zip com alguns XMLs dentro. Aqui o zip é "sem compressão" (método store): o arquivo fica um pouco
// maior, mas o código cabe nesta página e não puxa dependência nova pro projeto.

export type Celula = string | number | null | undefined | { data: Date | string | null } | { dinheiro: number | null }

export type Aba = {
    nome: string
    colunas: { titulo: string, largura?: number }[]
    linhas: Celula[][]
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

function xmlAba(aba: Aba) {
    const cabecalho = `<row r="1">${aba.colunas.map((col, i) =>
        `<c r="${nomeColuna(i)}1" t="inlineStr" s="3"><is><t>${escaparXml(col.titulo)}</t></is></c>`).join('')}</row>`
    const linhas = aba.linhas.map((linha, l) =>
        `<row r="${l + 2}">${linha.map((c, i) => xmlCelula(c, `${nomeColuna(i)}${l + 2}`)).join('')}</row>`).join('')
    const larguras = aba.colunas.map((col, i) => `<col min="${i + 1}" max="${i + 1}" width="${col.largura ?? 14}" customWidth="1"/>`).join('')
    const ultima = `${nomeColuna(Math.max(aba.colunas.length - 1, 0))}${aba.linhas.length + 1}`

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
<cols>${larguras}</cols>
<sheetData>${cabecalho}${linhas}</sheetData>
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

function arquivosDaPlanilha(abas: Aba[]): [string, string][] {
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
        ...abas.map((aba, i): [string, string] => [`xl/worksheets/sheet${i + 1}.xml`, xmlAba(aba)]),
    ]
}

// ---------- ZIP (sem compressão) ----------

const TABELA_CRC = (() => {
    const t = new Uint32Array(256)
    for (let n = 0; n < 256; n++) {
        let c = n
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1
        t[n] = c >>> 0
    }
    return t
})()

function crc32(dados: Buffer) {
    let c = 0xFFFFFFFF
    for (const byte of dados) c = TABELA_CRC[(c ^ byte) & 0xFF] ^ (c >>> 8)
    return (c ^ 0xFFFFFFFF) >>> 0
}

function zipar(arquivos: [string, string][]) {
    const partes: Buffer[] = []
    const central: Buffer[] = []
    let deslocamento = 0

    for (const [nome, conteudo] of arquivos) {
        const nomeBuf = Buffer.from(nome, 'utf8')
        const dados = Buffer.from(conteudo, 'utf8')
        const crc = crc32(dados)

        const local = Buffer.alloc(30)
        local.writeUInt32LE(0x04034b50, 0)
        local.writeUInt16LE(20, 4)        // versão necessária
        local.writeUInt16LE(0x0800, 6)    // nomes em UTF-8
        local.writeUInt16LE(0, 8)         // método 0 = store
        local.writeUInt32LE(0, 10)        // hora/data (zerado)
        local.writeUInt32LE(crc, 14)
        local.writeUInt32LE(dados.length, 18)
        local.writeUInt32LE(dados.length, 22)
        local.writeUInt16LE(nomeBuf.length, 26)
        local.writeUInt16LE(0, 28)
        partes.push(local, nomeBuf, dados)

        const cab = Buffer.alloc(46)
        cab.writeUInt32LE(0x02014b50, 0)
        cab.writeUInt16LE(20, 4)
        cab.writeUInt16LE(20, 6)
        cab.writeUInt16LE(0x0800, 8)
        cab.writeUInt16LE(0, 10)
        cab.writeUInt32LE(0, 12)
        cab.writeUInt32LE(crc, 16)
        cab.writeUInt32LE(dados.length, 20)
        cab.writeUInt32LE(dados.length, 24)
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

export function gerarXlsx(abas: Aba[]): Buffer {
    return zipar(arquivosDaPlanilha(abas))
}
