const {Telegraf, Markup} = require('telegraf')

const bot = new Telegraf('6212591235:AAHM9Zq2gsq-xVVrFFVnNBf3IU25bCL0CxU');

bot.start((ctx) => {
    const keyboard = Markup.keyboard([
        ['BTC', 'ETH', 'LTC', 'MATIC', ],
        ['TRX', 'FTM', 'LINK', 'AVAX', ],
        ['XRP','ZEC'],
    ])

    ctx.reply('Select a crypto currency:', keyboard)
})

let coinsArray = [];

bot.hears(['BTC', 'ETH', 'LTC', 'XRP', 'MATIC', 'TRX', 'FTM', 'LINK', 'AVAX', 'ZEC'], async (ctx) => {
    const coin = ctx.message.text;

        coinsArray.push(coin);
        if (coinsArray.length > 3) {
            coinsArray.shift();
        }
        const message = await ctx.reply('Loading...');
        getCoins(coin, message, ctx);
        setInterval(async () => {
            getCoins(coin, message, ctx);
        }, 5000);
});

async function getCoins(coin, message, ctx) {
    try {
        const binancePrice = await getBinanceBtcPrice(coin);
        const binanceUSPrice = await getBinanceUsBtcPrice(coin);
        const bybitPrice = await getBybitBtcPrice(coin);
        const kuCoinPrice = await getKucoinBtcPrice(coin);

        const prices = [
            { exchange: 'KuCoin', price: kuCoinPrice },
            { exchange: 'Binance US', price: binanceUSPrice },
            { exchange: 'Bybit', price: bybitPrice },
            { exchange: 'Binance', price: binancePrice },
        ];

        const priceValues = prices.map(({ price }) => price);
        const maxPrice = Math.max(...priceValues);
        const minPrice = Math.min(...priceValues);
        const spread = Math.floor(((maxPrice - minPrice) / minPrice) * 10000) / 100;

        prices.sort((a, b) => b.price - a.price);

        const newMessage =
            `${coin}USDT\n` +
            '===================\n\n' +
            prices.map(({ exchange, price }, index) => `${index + 1}. ${exchange}:  $${price}`).join('\n\n') +
            '\n\n===================\n' +
            `Spread: ${spread}%`;

        if (newMessage !== message.text ) {
            await ctx.telegram.editMessageText(ctx.chat.id, message.message_id, null, newMessage);
        }
    } catch (err) {
        console.error(err);
    }
}


/*bot.hears('ETH Price', async (ctx) => {
    const price = await getBinanceEthPrice();
    await ctx.reply(`The current price of ETH is ${price}`);
});*/

async function getBinanceBtcPrice(coin) {
    try {
        const response = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${coin}USDT`);
        const data = await response.json();
        return +data.price;
    } catch (error) {
        console.error(error);
        throw new Error('Failed to get Binance BTC price');
    }
}

async function getBinanceUsBtcPrice(coin) {
    try {
        const response = await fetch(`https://api.binance.us/api/v3/ticker/price?symbol=${coin}USDT`);
        if (!response.ok) {
            throw new Error(`Request failed with status code ${response.status}`);
        }
        const data = await response.json();
        return parseFloat(data.price);
    } catch (error) {
        console.error(error);
        return null;
    }
}

async function getBybitBtcPrice(coin) {
    try {
        const response = await fetch(`https://api.bybit.com/v2/public/tickers?symbol=${coin}USDT`);
        const data = await response.json();
        if (data.ret_code === 0) {
            return +data.result[0].last_price;
        } else {
            throw new Error(`Error retrieving price for ${coin}. Error code: ${data.ret_code}`);
        }
    } catch (error) {
        console.error(`Error getting price for ${coin} from Bybit: ${error.message}`);
        return null;
    }
}

async function getKucoinBtcPrice(coin) {
    try {
        const response = await fetch(`https://api.kucoin.com/api/v1/market/orderbook/level1?symbol=${coin}-USDT`);
        const data = await response.json();
        if (data && data.data && data.data.price) {
            return +data.data.price;
        } else {
            throw new Error('Price not found in API response');
        }
    } catch (error) {
        console.error(`Error fetching price from Kucoin API: ${error.message}`);
        throw error;
    }
}


// bot.command('start', async (ctx) => {
//     const message = await ctx.reply('Loading...');
// //
//     setInterval(async () => {
//         const binancePrice = await getBinanceBtcPrice();
//         const binanceUSPrice = await getBinanceUsBtcPrice();
//         const bybitPrice = await getBybitBtcPrice();
//         const kuCoinPrice = await getKucoinBtcPrice();
//
//         const prices = [binancePrice, binanceUSPrice, bybitPrice, kuCoinPrice];
//         prices.sort((a, b) => b - a);
//
//         const newMessage = `Binance: ${prices[0]}\nBinanceUS: ${prices[1]}\nBybit: ${prices[2]}\nKuCoin: ${prices[3]}`;
//
//         if (newMessage !== message.text) {
//             await ctx.telegram.editMessageText(ctx.chat.id, message.message_id, null, newMessage);
//         }
//     }, 3000); // обновление каждые 3 секундs
// });


bot.command('restart', (ctx) => {
    ctx.reply('Bot is restarting...');
    bot.stop(false);
    // здесь можно добавить код, который закроет все соединения, выйдет из всех сеансов и перезапустит бота
});


bot.catch((err) => {
    console.log('Error: аф', err)
})

bot.launch();
