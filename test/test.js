const { expect, should } = require("chai");
const { poll } = require("ethers/lib/utils");
const { waffle,ethers } = require("hardhat");
const { userInfo } = require("os");
const provider = waffle.provider;
const web3 = require("web3");
const {abi} = require("../abi.json");


const weiToEth = (wei) => wei / 10**18;
const mweiToEth = (wei) => wei / 10**6;
const gweiToEth = (wei) => wei / 10**9;
const ethToWei = (eth) => ethers.utils.parseUnits(eth, "ether");
const mweiToWei = (mwei) => ethers.utils.parseUnits(mwei, "mwei");
const gweiToWei = (gwei) => ethers.utils.parseUnits(gwei, "gwei");

async function impersonateWallet(wallet) {
    await provider.send("hardhat_impersonateAccount", [wallet]);
    const signer = provider.getSigner(wallet);
    return signer;
}

describe('Greeter', () =>{
    let greeter;
    const [owner, accountOne] = provider.getWallets();
    
    const ADDRESSES = {
        DAI:"0x6B175474E89094C44Da98b954EedeAC495271d0F",
        USDT:"0xdAC17F958D2ee523a2206206994597C13D831ec7",
        USER1:"0xd8da6bf26964af9d7eed9e03e53415d37aa96045", //has 555,508 dai
        USER2:"0x74dec05e5b894b0efec69cdf6316971802a2f9a1",  //has 288,954 usdt
        DAI_CONTRACT:null,
        USDT_CONTRACT:null,
    }
    before(async () => {
        ADDRESSES.DAI_CONTRACT = await ethers.getContractAt(abi, ADDRESSES.DAI, owner);
        ADDRESSES.USDT_CONTRACT = await ethers.getContractAt(abi, ADDRESSES.USDT, owner);
        console.log(ADDRESSES.DAI_CONTRACT.address);
        console.log(ADDRESSES.USDT_CONTRACT.address);
    })



    beforeEach( async () =>{
        const Greeter = await ethers.getContractFactory("Greeter");
        greeter = await Greeter.deploy("Hello World");
    })


    it('Should return set string', async () => {
        let message = await greeter.greet();
        expect(message).equal("Hello World");
    })
    xit('should show user1 dai balance', async () => {
        let bal1 = await ADDRESSES.DAI_CONTRACT.balanceOf(ADDRESSES.USER1);
        console.log("User1 DAI balance: ", weiToEth(bal1));
    })
    xit('should show user2 usdt balance', async () => {
        let bal1 = await ADDRESSES.USDT_CONTRACT.balanceOf(ADDRESSES.USER2);
        console.log("User2 USDT balance: ", mweiToEth(bal1));
    })
    it('should transfer DAI from USER1 to USER2', async () => {
        let balInitial = await ADDRESSES.DAI_CONTRACT.balanceOf(ADDRESSES.USER1);
        //impersnate user1
        const signer = await impersonateWallet(ADDRESSES.USER1);

        //send 1 dai from user1 to user2
        let tx = await ADDRESSES.DAI_CONTRACT.connect(signer).transfer(ADDRESSES.USER2, ethToWei("1"));

        //check user2 balance
        let balAfter = await ADDRESSES.DAI_CONTRACT.balanceOf(ADDRESSES.USER1);
        expect(balAfter).to.be.below(balInitial);      
    })
    it('should speed up the transaction',async ()=> {
        //get initail balance of user 1
        let balInitial = await ADDRESSES.DAI_CONTRACT.balanceOf(ADDRESSES.USER1);
        let bal2Initial = await ADDRESSES.DAI_CONTRACT.balanceOf(ADDRESSES.USER2);

        console.log("at 1st tx user 1 bal: ", weiToEth(balInitial));

        //impersonate user1
        const signer = await impersonateWallet(ADDRESSES.USER1);
        await network.provider.send("evm_setIntervalMining", [12000]);
        //off automining
        await network.provider.send("evm_setAutomine", [false]);
        
        //execute transaction first tx
        let tx1 = await ADDRESSES.DAI_CONTRACT.connect(signer).transfer(ADDRESSES.USER2, ethToWei("1"));

        //remove useless properties for next tx
        let tx1Wait = await tx1.wait();
        delete tx1.hash; delete tx1.blockHash; delete tx1.blockNumber; delete tx1.confirmations;
        delete tx1.transactionIndex; delete tx1.r; delete tx1.s; delete tx1.v ; delete tx1.creates; delete tx1.wait;
        delete tx1.maxFeePerGas; delete tx1.maxPriorityFeePerGas

        const txObject2 = {
            ...tx1,
            nonce: tx1.nonce,
            gasPrice: tx1.gasPrice.mul(2),
            data:"0x",
            to: ADDRESSES.USER1,
        }
        //send second tx with higher gas price and same nonce
        console.log('before sending second tx',  await ADDRESSES.DAI_CONTRACT.balanceOf(ADDRESSES.USER1));
        await signer.sendTransaction(txObject2)
        //mine the first transaction
        await network.provider.send("evm_setAutomine", [true]);
        await tx1Wait();
        await network.provider.send("evm_mine");

        //remains the same
        let balAfter = await ADDRESSES.DAI_CONTRACT.balanceOf(ADDRESSES.USER1);
        const bal2After = await ADDRESSES.DAI_CONTRACT.balanceOf(ADDRESSES.USER2);
        expect(balAfter).eq(balInitial);
        expect(bal2Initial).eq(bal2After);
    })


   
})