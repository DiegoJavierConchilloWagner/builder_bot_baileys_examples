import { createBot, createProvider, createFlow, addKeyword, utils, EVENTS } from '@builderbot/bot'
import { MemoryDB as Database } from '@builderbot/bot'
import { BaileysProvider as Provider } from '@builderbot/provider-baileys'
import { config } from 'dotenv'
config()

const PHONE_NUMBER = process.env.PHONE_NUMBER
const PORT = process.env.PORT ?? 3008
let msg: any = {}

const welcomeFlow = addKeyword<Provider, Database>(EVENTS.WELCOME)
    .addAnswer(`🙌 Example got Messages`)
    .addAction(
        async (_, { provider, flowDynamic }) => {
            const messagesPromise = new Promise(resolve => {
                provider.vendor.ev.on('messages.upsert', ({ messages }) => {
                    msg = messages
                    resolve(messages)
                })
            })
            await messagesPromise
            await flowDynamic(JSON.stringify(msg, null, 5))
        }
    )

const main = async () => {
    const adapterFlow = createFlow([welcomeFlow])

    const adapterProvider = createProvider(Provider, { usePairingCode: true, phoneNumber: PHONE_NUMBER })
    const adapterDB = new Database()

    const { handleCtx, httpServer } = await createBot(
        {
            flow: adapterFlow,
            provider: adapterProvider,
            database: adapterDB,
        }
    )


    httpServer(+PORT)

    adapterProvider.http.server.post(
        '/v1/messages',
        handleCtx(async (bot, req, res) => {
            const { number, message, urlMedia } = req.body
            await bot.sendMessage(number, message, { media: urlMedia ?? null })
            return res.end('sended')
        })
    )

    adapterProvider.http.server.post(
        '/v1/register',
        handleCtx(async (bot, req, res) => {
            const { number, name } = req.body
            await bot.dispatch('REGISTER_FLOW', { from: number, name })
            return res.end('trigger')
        })
    )

    adapterProvider.http.server.post(
        '/v1/blacklist',
        handleCtx(async (bot, req, res) => {
            const { number, intent } = req.body
            if (intent === 'remove') bot.blacklist.remove(number)
            if (intent === 'add') bot.blacklist.add(number)

            res.writeHead(200, { 'Content-Type': 'application/json' })
            return res.end(JSON.stringify({ status: 'ok', number, intent }))
        })
    )
}

main()
