const axios = require("axios");

const puppeteer = require("puppeteer");
// node node_modules/puppeteer/install.js

async function sleep(duration) {
    return new Promise(resolve => {
        setTimeout(resolve, duration);
    })
}

async function run() {
    const email = process.env.EMAIL;
    const password = process.env.PASSWORD;
    const base_url = process.env.BASE_URL || "https://cdn.v2free.net/";


    console.log("email:", email);
    console.log("password:", password);
    console.log("base_url:", base_url);
    if (!email || !password) {
        console.error("用户名/密码缺失!");
        return;
    }
    try {
        console.log("=> 启动浏览器");
        const browser = await puppeteer.launch({
            args: ["--no-sandbox",'--disable-extensions'],
            headless: "new",
            defaultViewport: null,
            timeout: 100000
        });
        console.log("=> 打开机场页面");
        const page = await browser.newPage();
        await page.goto(base_url, {
            timeout: 1000*60    //60s
        });
        const loginLink = await page.$(`a[href="/auth/login"]`);
        if (loginLink) {
            console.log("=> 进入登录页面");
            loginLink.click();
            console.log("=> 点击登录按钮");
            await page.waitForNavigation();
            console.log("=> 进入登录表单页面");
            await page.$eval('input[name="Email"]', (input, email) => {
                input.value = email;
            }, email);
            console.log("=> 填写邮箱");
            await page.$eval('input[name="Password"]', (input, password) => {
                input.value = password;
            }, password);
            console.log("=> 填写密码");
            const loginButton = await page.$("#login");
            loginButton.click();
            console.log("=> 点击登录");
            await page.waitForNavigation();
            console.log("=> 进入首页");
            // await page.evaluate(() => {
            //     window.scrollTo(0, document.body.scrollHeight);
            // });
            // console.log("=> 滚动到页面底部");
            await sleep(1000);
            console.log("=> 点击签到");
            await page.evaluate(() => {
                const targetElement = document.querySelector('.usercheck #checkin');
                if (targetElement) {
                    targetElement.click();
                }
            });
            let flag = 0;
            let interval = setInterval(async () => {
                console.log("=> 检查是否已签到:", flag)
                if (flag > 10) {
                    browser.close();
                    clearInterval(interval);
                    throw "=> 签到失败";
                }
                try {
                    const buttonText = await page.$eval(".usercheck a.btn-brand", (btn) => btn.textContent.trim());
                    if (buttonText.includes("已签到")) {
                        console.log("=> 签到成功");
                        clearInterval(interval);
                        console.log("=> 获取剩余流量")
                        const lastCount = await page.$eval("#account-status .nodemain .nodename:first-child", ele => ele.textContent.trim()) || "";
                        console.log("=>", lastCount);
                        await sent_message_by_pushplus(`机场签到成功：\n${email}\n${lastCount}`);
                    }
                    browser.close();
                } catch (error) {
                }
                flag++;
            }, 1000);
        }

    } catch (error) {
        console.error(error.message);
        await sent_message_by_pushplus(error.message);
        process.exit(0);
    }
}

async function sent_message_by_pushplus(message) {
    const PUSHPLUS_TOKEN = process.env.PUSHPLUS_TOKEN;

    if (!PUSHPLUS_TOKEN) {
        return;
    }
    console.log("=> 发送pushplus: \n" + message);
    let timer = new Date()
    let data = {
        token: PUSHPLUS_TOKEN,
        title: "v2free-checkin_" + timer.toLocaleString(),
        content: message
    }

    try {
        await axios.post("http://www.pushplus.plus/send", data);
        console.log("=> 发送pushplus成功");
    } catch (error) {
        console.log("=> 发送pushplus失败:");
        console.error(error);
    }
}

run();
