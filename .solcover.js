module.exports = {
    norpc: true,
    copyNodeModules: false,
    copyPackages: ['zeppelin-solidity'],
    testCommand: 'node --max-old-space-size=4096 ../node_modules/.bin/truffle test --network coverage',
    skipFiles: ['lifecycle/Migrations.sol']
}
