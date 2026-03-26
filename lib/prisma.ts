import { Pool } from 'pg'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const prismaClientSingleton = () => {
    // 1. Cria o pool de conexão usando o driver nativo 'pg'
    const pool = new Pool({ connectionString: process.env.DATABASE_URL })

    // 2. Cria o adaptador que o Prisma 7 exige
    const adapter = new PrismaPg(pool as unknown as ConstructorParameters<typeof PrismaPg>[0])
    // 3. Instancia o cliente passando o adaptador
    return new PrismaClient({ adapter })
}

declare global {
    var prisma: undefined | ReturnType<typeof prismaClientSingleton>
}

const prisma = globalThis.prisma ?? prismaClientSingleton()

export default prisma

if (process.env.NODE_ENV !== 'production') globalThis.prisma = prisma