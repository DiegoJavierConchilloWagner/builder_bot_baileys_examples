import { createBot, createProvider, createFlow, addKeyword, utils, EVENTS } from '@builderbot/bot'
import { MemoryDB as Database } from '@builderbot/bot'
import { BaileysProvider as Provider } from '@builderbot/provider-baileys'
import { config } from 'dotenv'
import { WACallEvent } from '@whiskeysockets/baileys/lib/Types/Call'
config()

const PHONE_NUMBER = process.env.PHONE_NUMBER
const PORT = process.env.PORT ?? 3008
const msgs: WACallEvent[] = []

const welcomeFlow = addKeyword<Provider, Database>(EVENTS.WELCOME)
    .addAnswer(
        `🙌 Example eventCallObject`,
        null,
        async (ctx, { provider, flowDynamic }) => {
            const messagesPromise = new Promise(resolve => {
                provider.vendor.ev.process(
                    async (events) => {
                        if (events.call) {
                            msgs.push({
                                chatId: events.call[0].chatId,
                                from: events.call[0].from,
                                isGroup: events.call[0].isGroup,
                                groupJid: events.call[0].groupJid,
                                id: events.call[0].id,
                                date: events.call[0].date,
                                isVideo: events.call[0].isVideo,
                                status: events.call[0].status,
                                offline: events.call[0].offline,
                                latencyMs: events.call[0].latencyMs,
                            })
                            if (events.call[0].status === 'timeout' || events.call[0].status === 'accept') {
                                resolve(msgs)
                            }
                        }
                    }
                )
            })
            const msgsPromise = await messagesPromise
            await flowDynamic(JSON.stringify(msgsPromise, null, 5))
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
