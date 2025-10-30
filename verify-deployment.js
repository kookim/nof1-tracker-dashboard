// 验证Cloudflare Workers部署配置
const { readFileSync, existsSync } = require('fs');
const { join } = require('path');

const checks = {
    passed: 0,
    failed: 0,
    warnings: 0
};

function check(condition, message, isWarning = false) {
    if (condition) {
        console.log(`✅ ${message}`);
        checks.passed++;
    } else {
        if (isWarning) {
            consoleมาณ(`⚠️  ${message}`);
            checks.warnings++;
        } else {
            console.log(`❌ ${message}`);
            checks.failed++;
        }
    }
}

function checkFile(file, description) {
    const exists = existsSync(join(__dirname, file));
    check(exists, `${description}: ${file}`, false);
    return exists;
}

console.log('🔍 开始验证Cloudflare Workers部署配置...\n');

// 1. 检查必需文件
console.log('📁 检查必需文件:');
checkFile('wrangler.toml', 'Wrangler配置文件');
checkFile('package.json', 'Package配置文件');
checkFile('src/index.js', 'Worker入口文件');

// 2. 检查wrangler.toml配置
if (checkFile('wrangler.toml', 'wrangler.toml')) {
    console.log('\n📋 检查wrangler.toml配置:');
    try {
        const wranglerContent = readFileSync(join(__dirname, 'wrangler.toml'), 'utf-8');
        check(wranglerContent.includes('name ='), '包含name配置');
        check(wranglerContent.includes('main ='), '包含main入口配置');
        check(wranglerContent.includes('compatibility_date'), '包含compatibility_date');
        
        if (wranglerContent.includes('[site]')) {
            check(wranglerContent.includes('bucket'), '包含site.bucket配置（静态资源）');
        }
    } catch (e) {
        check(false, `无法读取wrangler.toml: ${e.message}`);
    }
}

// 3. 检查package.json配置
if (checkFile('package.json', 'package.json')) {
    console.log('\n📦 检查package.json配置:');
    try {
        const pkg = JSON.parse(readFileSync(join(__dirname, 'package.json'), 'utf-8'));
        check(!!pkg.scripts.dev || !!pkg.scripts.deploy, '包含dev或deploy脚本');
        check(!!pkg.devDependencies?.wrangler || !!pkg.dependencies?.wrangler, '包含wrangler依赖', true);
        check(!!pkg.devDependencies?.['@cloudflare/kv-asset-handler'], '包含@cloudflare/kv-asset-handler', true);
    } catch (e) {
        check(false, `无法解析package.json: ${e.message}`);
    }
}

// 4. 检查Worker入口文件
if (checkFile('src/index.js', 'Worker入口文件')) {
    console.log('\n⚙️  检查Worker入口文件:');
    try {
        const indexContent = readFileSync(join(__dirname, 'src/index.js'), 'utf-8');
        check(indexContent.includes('export default'), '导出default handler');
        check(indexContent.includes('async fetch'), '包含fetch处理函数');
        check(indexContent.includes('getAssetFromKV'), '使用KV asset handler');
        check(indexContent.includes('BINANCE_API_KEY'), '引用环境变量BINANCE_API_KEY');
        check(indexContent.includes('BINANCE_SECRET_KEY'), '引用环境变量BINANCE_SECRET_KEY');
    } catch (e) {
        check(false, `无法读取src/index.js: ${e.message}`);
    }
}

// 5. 检查静态资源目录
console.log('\n📂 检查静态资源:');
const publicDir = join(__dirname, 'public');
if (existsSync(publicDir)) {
    check(true, 'public目录存在');
    const publicFiles = ['binance-tracker.html', 'script.js', 'styles.css'];
    publicFiles.forEach(file => {
        const exists = existsSync(join(publicDir, file));
        check(exists, `静态文件: ${file}`, false);
    });
} else {
    check(false, 'public目录不存在');
}

// 6. 检查环境变量配置
console.log('\n🔐 检查环境变量配置:');
checkFile('.env.example', '环境变量示例文件');

console.log('\n' + '='.repeat(50));
console.log(`\n📊 验证结果总结:`);
console.log(`✅ 通过: ${checks.passed}`);
console.log(`❌ 失败: ${checks.failed}`);
console.log(`⚠️  警告: ${checks.warnings}`);

if (checks.failed === 0) {
    console.log(`\n🎉 项目配置看起来可以部署到Cloudflare Workers!`);
    console.log(`\n📝 下一步:`);
    console.log(`   1. 运行 npm install 安装依赖`);
    console.log(`   2. 配置环境变量 (BINANCE_API_KEY, BINANCE_SECRET_KEY)`);
    console.log(`   3. 运行 npm run dev 进行本地测试`);
    console.log(`   4. 运行 npm run deploy 部署到Cloudflare`);
    process.exit(0);
} else {
    console.log(`\n⚠️  发现一些问题，请先修复后再部署`);
    process.exit(1);
}
