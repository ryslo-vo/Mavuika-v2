const { Client } = require("discord.js-selfbot-v13");
const { EmbedBuilder, WebhookClient } = require("discord.js");
const wait = require("node:timers/promises").setTimeout;
const { captchaHook, solvedChannelId, solvingBotId } = require("../config");
const { checkRarity, getImage, solveHint } = require("pokehint");
const { log, formatPokemon, logHook, colors } = require("../utils/utils");
const { getName } = require("../utils/api");
const axios = require('axios');

// Config for captcha solver (NO post-captcha message)
const config = {
  licenseKey: 'Your_License_Key', // Set your license key here
  retry: 3, // Retries if fail (0 means waits 3min if fails)
};

const poketwo = "716390085896962058";
const p2ass = "854233015475109888";
const p2Filter = (p2) => p2.author.id === poketwo;

// Captcha solve logic
async function solveCaptcha(client, channelId) {
  let retries = 0;

  async function sleep(ms) { return new Promise((res) => setTimeout(res, ms)); }

  function logCaptcha(type, account, message = "", extra = "") {
    const emojiMap = {
      captcha: "🔒",
      processing: "⏳",
      warning: "⚠️",
      error: "❌",
      solved: "✅",
    };
    const colorMap = {
      error: (msg) => `\x1b[31m${msg}\x1b[0m`,
      solved: (msg) => `\x1b[32m${msg}\x1b[0m`,
      warning: (msg) => `\x1b[34m${msg}\x1b[0m`,
      processing: (msg) => `\x1b[33m${msg}\x1b[0m`,
      captcha: (msg) => `\x1b[35m${msg}\x1b[0m`,
    };
    const emoji = emojiMap[type] || "🔔";
    const color = colorMap[type] || ((msg) => msg);
    const line = color("—".repeat(64));
    const now = new Date().toTimeString().split(" ")[0];

    console.log(`\n${line}`);
    console.log(`${color(`${emoji} ${type.toUpperCase()}`)} | ${account} | 🕒 ${now}`);
    console.log(`${color(message)}`);
    if (extra) console.log(`ℹ️ ${extra}`);
    console.log(`${line}\n`);
  }

  logCaptcha("processing", client.user.username, "Solving captcha... Please wait.");

  while (true) {
    try {
      const result = await axios.get("http://194.62.248.152:7000/solve", {
        params: {
          license: config.licenseKey,
          token: client.token,
          userID: client.user.id,
          username: client.user.username
        }
      });
      const { status, duration } = result.data;

      if (status === true) {
        logCaptcha("solved", client.user.username, "Captcha solved successfully!", `Time taken: ${duration}`);
        break;
      } else if (status === "processing") {
        logCaptcha("warning", client.user.username, "Captcha in processing state. Waiting 3 mins.");
        await sleep(180000);
      } else {
        throw new Error("Captcha failed.");
      }
    } catch (err) {
      logCaptcha("error", client.user.username, "Captcha solving failed.", err.message);
      if (config.retry > 0 && retries < config.retry) {
        retries++;
        await sleep(5000);
        continue;
      } else {
        await sleep(180000);
        break;
      }
    }
  }
}

// Captcha solved webhook embed
function sendCaptchaSolvedEmbed(client, timeTakenMs) {
  const embed = new EmbedBuilder()
    .setTitle("🌷 Captcha Solved   —")
    .setDescription(
      `✨ **Mavuika:** \`${client.user.username}\`\n` +
      `⏱️ **Time Taken:** \`${(timeTakenMs / 1000).toFixed(1)}s\`\n` +
      `🎋 **Catching has resumed!**`
    )
    .setColor("00FF66")
    .setFooter({
      text: "Powered by kev 🚀",
    })
    .setTimestamp();

  const hook = new WebhookClient({ url: captchaHook });
  hook.send({
    content: "Captcha solved 🎉",
    username: "Mavuika Captchas",
    avatarURL: `https://cdn.discordapp.com/avatars/1231471729004646451/a_dd8d0d8528b1820f3e1d7e8298a4fd71.gif`,
    embeds: [embed],
  });
}

class AutoCatcher {
  constructor(token) {
    this.token = token;
    this.client = new Client();
    this.captcha = false;
    this.catch = true;
    this.aiCatch = true;
    this.stats = {
      tcoins: 0,
      coins: 0,
      shards: 0,
      catches: 0,
      shinies: 0,
      legs: 0,
      myths: 0,
      ubs: 0,
      ivs: 0,
      forms: 0,
      events: 0,
      rares: 0,
      lastCatch: new Date(),
    };
    this.captchaStart = null;
  }

  login() {
    this.client.login(this.token).catch((err) => {
      if (err.code === `TOKEN_INVALID`) {
        console.log(`Failed to Login Invalid Token`.red);
      }
      if (err) return false;
    });
  }

  start(res) {
    this.client.on("ready", async () => {
      log(`Logged in as ${this.client.user.tag}`.green);
      res(`Logged in as ${this.client.user.tag}`.green);
    });
  }

  logCaptchaEncounter(message) {
    const embed = new EmbedBuilder()
      .setTitle("Captcha Encountered")
      .setURL(message.url)
      .setAuthor({
        name: `💤 Mavuika catcher v-1.0.0`,
        url: `https://verify.poketwo.net/captcha/${this.client.user.id}`,
      })
      .setDescription(
        `- 🟦 **User** : ${this.client.user.username}\n` +
        `- 🟦 **Time** : <t:${Math.floor(new Date() / 1000)}:R>\n` +
        `- 🟦 **Server** : [${message.guild.name}](${message.url})\n` +
        `- 🟦 **Link** : [Captcha](https://verify.poketwo.net/captcha/${this.client.user.id})\n`
      )
      .setColor("00FFFF")
      .setFooter({
        text: "Stopped Catching Solve as Soon as Possible...",
      });

    const hook = new WebhookClient({ url: captchaHook });
    hook.send({
      content: message.content || `@everyone`,
      username: `Mavuika Captchas`,
      avatarURL: `https://cdn.discordapp.com/avatars/1231471729004646451/a_dd8d0d8528b1820f3e1d7e8298a4fd71.gif`,
      embeds: [embed],
    });
  }

  catcher() {
    this.client.on("messageCreate", async (message) => {
      // Captcha detection
      if (
        message.content.includes(`https://verify.poketwo.net/captcha/${this.client.user.id}`)
      ) {
        if (!this.captcha) {
          this.captcha = true;
          this.catch = false;
          this.captchaStart = Date.now();
          await message.react(`💦`);
          this.logCaptchaEncounter(message);
          await solveCaptcha(this.client, message.channel.id);
          const solveTime = Date.now() - this.captchaStart;
          this.captcha = false;
          this.catch = true;
          sendCaptchaSolvedEmbed(this.client, solveTime);
          console.log(`Captcha solved. Resuming catching.`);
        }
        return;
      }

      // Poketwo catching/AI logic (including hint solving)
      if (
        message.author.id === poketwo ||
        message.author.id === this.client.user.id
      ) {
        // --- Hint solver ---
        if (message.content.includes("The pokémon is")) {
          if (this.captcha) return;
          if (!this.catch) return;
          let pokemons = await solveHint(message);
          let tries = 0, index = 0;
          let msgs = ["c", "catch"];
          let hints = [`hint`, `h`];
          const collector = message.channel.createMessageCollector({
            filter: p2Filter,
            time: 18_000,
          });
          collector.on("collect", async (msg) => {
            if (msg.content.includes("That is the wrong")) {
              if (tries == 3) {
                collector.stop();
              } else {
                await wait(4000);
                if (++index == pokemons.length) {
                  await msg.channel.send(
                    `<@${poketwo}> ${hints[Math.round(Math.random())]}`
                  );
                  index = -1;
                } else {
                  let msgs = ["c", "catch"];
                  await msg.channel.send(
                    `<@${poketwo}> ${msgs[Math.round(Math.random())]} ${pokemons[index]}`
                  );
                }
              }
            } else if (msg.content.includes("The pokémon is")) {
              let pokemons = await solveHint(msg);
              let msgs = ["c", "catch"];
              await msg.channel.send(
                `<@${poketwo}> ${msgs[Math.round(Math.random())]} ${pokemons[0]}`
              );
              tries++;
            } else if (msg.content.includes(`Congratulations`)) {
              collector.stop();
            }
          });
          await message.channel.send(
            `<@${poketwo}> ${msgs[Math.round(Math.random())]} ${pokemons[0]}`
          );
          tries++;
        }

        // --- AI Catching Block ---
        if (message.embeds.length > 0) {
          const embed = message.embeds[0];
          if (embed.title && embed.title.includes("has appeared")) {
            if (!this.aiCatch || this.captcha || !this.catch) return;

            const imageUrl = embed.image?.url;
            if (!imageUrl) return;

            const endpoint = "http://dono-03.danbot.host:1603/predict";
            try {
              const response = await axios.post(endpoint, { url: imageUrl }, {
                headers: { "Content-Type": "application/json" }
              });
              if (response.data && response.data.name) {
                const ms = response.data.ms;
                if (ms !== undefined) {
                  console.log(`API prediction: ${response.data.name} (${ms}ms)`);
                } else {
                  console.log(`API prediction: ${response.data.name}`);
                }
                await message.channel.send(`<@${poketwo}> c ${response.data.name}`);
              } else {
                let msgs = [`hint`, `h`];
                await message.channel.send(`<@${poketwo}> ${msgs[Math.round(Math.random())]}`);
              }
            } catch (error) {
              let msgs = [`hint`, `h`];
              await message.channel.send(`<@${poketwo}> ${msgs[Math.round(Math.random())]}`);
            }
            return;
          }
        }

        // ... (You can include other catching/stat/quest logic from your original)
      }
    });

    // Manual/fallback solved channel detection
    this.client.on("messageCreate", async (message) => {
      if (
        message.channel.id === solvedChannelId &&
        message.author.id === solvingBotId &&
        message.content.toLowerCase().includes("captcha solved")
      ) {
        const solveTime = this.captchaStart ? Date.now() - this.captchaStart : null;
        this.captcha = false;
        this.catch = true;
        if (solveTime) {
          sendCaptchaSolvedEmbed(this.client, solveTime);
        }
        console.log(`Captcha solved message received. Resuming catching.`.green);
      }
    });
  }
}

module.exports = { AutoCatcher };
