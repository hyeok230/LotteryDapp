const { assert } = require("chai");
const assertRevert = require("./assertRevert");
const expectEvent = require("./expectEvent");
const Lottery = artifacts.require("Lottery");

//function의 파라미터로 최대 10개까지 줄 수 있다.
//ganache에서 만든 10가지의 account들이 순서대로 들어오게 된다.
//deployer - 0번 주소, user1 - 1번 주소, user2 - 2번 주소

//migrations 폴더에 있는 deploy script는 사실 test할 때는 사용되지 않는다
//따라서 lottery = await Lottery.new(); 를 통해 배포하는 것이 좋다
//migrations가 돌지만 클린룸에서 사용하는 스마트컨트랙트를 사용하는 것이 좋기 때문이다
//즉, deploy된 스마트 컨트랙트를 연계할 수 도 있지만 항상 클린룸에 새로 배포해 줄 것
contract('Lottery', function([deployer, user1, user2]){
    let lottery;
    let betAmount = 5 * 10 ** 15;
    let betAmountBN = new web3.utils.BN('5000000000000000');
    let bet_block_interval = 3;
    
    beforeEach(async () => {
        lottery = await Lottery.new();
    })

    // 테스트 시 한 파일 내에서 하나의 테스트만 시행하고 싶은 경우
    // it.only를 사용하면 된다.
    it('getPot should return current pot', async () => {
        console.log('Basic test')
        let pot = await lottery.getPot();
    
        console.log(`value : ${pot}`);
        assert.equal(pot, 0)
    })

    describe('Bet', function () {
        it('should fail when the bet money is not 0.005 ETH', async () => {
            // Fail transaction
            await assertRevert(lottery.bet('0xab', {from : user1, value : 4000000000000000}))
            // transaction object {chainId, value, to, from, gasLimit, gasPrice}
        })
        
        it('should put the bet to the Bet queue with 1 bet', async () => {
            // bet
            let receipt = await lottery.bet('0xab', {from : user1, value : betAmount})
            // console.log(receipt);

            let pot = await lottery.getPot();
            assert.equal(pot, 0);
            // check contract blance == 0.05
            let contractBalance = await web3.eth.getBalance(lottery.address);
            assert.equal(contractBalance, betAmount)
            // check Bet info
            let currentBlockNumber = await web3.eth.getBlockNumber();
            let bet = await lottery.getBetInfo(0);

            assert.equal(bet.answerBlockNumber, currentBlockNumber + bet_block_interval);
            assert.equal(bet.bettor, user1);
            assert.equal(bet.challenges, '0xab');
            // check log
            // console.log(receipt);
            await expectEvent.inLogs(receipt.logs, 'BET')
        })
    })

    describe('isMatch', function() {
        let blockHash = '0xab17b7e54b0ee749f38a478df0f485fc8a99c6aaa8d2aae379a09827aeb5301e'

        it('should be BettingResult.Win when two characters match', async () => {
            let matchResult = await lottery.isMatch('0xab', blockHash)
            assert.equal(matchResult, 1); //win
        })

        it('should be BettingResult.Fail when two characters match', async () => {
            let matchResult = await lottery.isMatch('0xdd', blockHash)
            assert.equal(matchResult, 0); // fail
        })

        it('should be BettingResult.Draw when two characters match', async () => {
            let matchResult = await lottery.isMatch('0xac', blockHash)
            assert.equal(matchResult, 2); // draw
        })
    })

    describe('Distribute', function () {
        describe('When the answer is checkable', function () {
            it('should give the user the pot when the answer matches', async () => {
                // 두 글자 다 맞았을 때
                await lottery.setAnswerForTest('0xab17b7e54b0ee749f38a478df0f485fc8a99c6aaa8d2aae379a09827aeb5301e', {from : deployer});
                await lottery.betAndDistribute('0xef', {from : user2, value : betAmount}); // 1 -> 4
                await lottery.betAndDistribute('0xef', {from : user2, value : betAmount}); // 2 -> 5
                await lottery.betAndDistribute('0xab', {from : user1, value : betAmount}); // 3 -> 6
                await lottery.betAndDistribute('0xef', {from : user2, value : betAmount}); // 4 -> 7
                await lottery.betAndDistribute('0xef', {from : user2, value : betAmount}); // 5 -> 8
                await lottery.betAndDistribute('0xef', {from : user2, value : betAmount}); // 6 -> 9

                let potBefore = await lottery.getPot(); //  == 0.01 ETH
                let user1BlanceBefore = await web3.eth.getBalance(user1);
                
                let receipt7 = await lottery.betAndDistribute('0xef', {from : user2, value : betAmount}); // 7 -> 10 // user1에게 pot이 간다.
                
                let potAfter = await lottery.getPot(); // == 0 ETH
                let user1BlanceAfter = await web3.eth.getBalance(user1); // == before + 0.015 ETH

                // pot 의 변화량 확인
                assert.equal(potBefore.toString(), new web3.utils.BN('10000000000000000').toString());
                assert.equal(potAfter.toString(), new web3.utils.BN('0').toString());
                // user(winner)의 밸런스를 확인 -> user1BlanceBefore + potBefore + betAmountBN = user1BlanceAfter
                // console.log(typeof user1BlanceBefore);
                user1BlanceBefore = new web3.utils.BN(user1BlanceBefore);
                assert.equal(user1BlanceBefore.add(potBefore).add(betAmountBN).toString(), new web3.utils.BN(user1BlanceAfter).toString());
            })

            it('should give the user the amount he or she bet when a single character matches', async () => {
                // 한 글자만 맞았을 때
                await lottery.setAnswerForTest('0xab17b7e54b0ee749f38a478df0f485fc8a99c6aaa8d2aae379a09827aeb5301e', {from : deployer});
                await lottery.betAndDistribute('0xef', {from : user2, value : betAmount}); // 1 -> 4
                await lottery.betAndDistribute('0xef', {from : user2, value : betAmount}); // 2 -> 5
                await lottery.betAndDistribute('0xaf', {from : user1, value : betAmount}); // 3 -> 6
                await lottery.betAndDistribute('0xef', {from : user2, value : betAmount}); // 4 -> 7
                await lottery.betAndDistribute('0xef', {from : user2, value : betAmount}); // 5 -> 8
                await lottery.betAndDistribute('0xef', {from : user2, value : betAmount}); // 6 -> 9

                let potBefore = await lottery.getPot(); //  == 0.01 ETH
                let user1BlanceBefore = await web3.eth.getBalance(user1);
                
                let receipt7 = await lottery.betAndDistribute('0xef', {from : user2, value : betAmount}); // 7 -> 10 // user1에게 pot이 간다.
                
                let potAfter = await lottery.getPot(); // == 0.01 ETH
                let user1BlanceAfter = await web3.eth.getBalance(user1); // == before + 0.005 ETH

                // pot 의 변화량 확인 -> draw 임으로 pot의 변화는 없다.
                assert.equal(potBefore.toString(), potAfter.toString());

                // user(winner)의 밸런스를 확인 -> user1BlanceBefore + betAmountBN = user1BlanceAfter
                user1BlanceBefore = new web3.utils.BN(user1BlanceBefore);
                assert.equal(user1BlanceBefore.add(betAmountBN).toString(), new web3.utils.BN(user1BlanceAfter).toString());
            })

            it('should get the eth of user when the answer does not match at all', async () => {
                // 다 틀렸을 때
                await lottery.setAnswerForTest('0xab17b7e54b0ee749f38a478df0f485fc8a99c6aaa8d2aae379a09827aeb5301e', {from : deployer});
                await lottery.betAndDistribute('0xef', {from : user2, value : betAmount}); // 1 -> 4
                await lottery.betAndDistribute('0xef', {from : user2, value : betAmount}); // 2 -> 5
                await lottery.betAndDistribute('0xef', {from : user1, value : betAmount}); // 3 -> 6
                await lottery.betAndDistribute('0xef', {from : user2, value : betAmount}); // 4 -> 7
                await lottery.betAndDistribute('0xef', {from : user2, value : betAmount}); // 5 -> 8
                await lottery.betAndDistribute('0xef', {from : user2, value : betAmount}); // 6 -> 9

                let potBefore = await lottery.getPot(); //  == 0.01 ETH
                let user1BlanceBefore = await web3.eth.getBalance(user1);
                
                let receipt7 = await lottery.betAndDistribute('0xef', {from : user2, value : betAmount}); // 7 -> 10 // user1에게 pot이 간다.
                
                let potAfter = await lottery.getPot(); // == 0.015 ETH
                let user1BlanceAfter = await web3.eth.getBalance(user1); // == before 

                // pot 의 변화량 확인 -> fail 임으로 pot이 0.005 ETH 증가한다.
                assert.equal(potBefore.add(betAmountBN).toString(), potAfter.toString());

                // user(winner)의 밸런스를 확인 -> user1BlanceBefore = user1BlanceAfter
                user1BlanceBefore = new web3.utils.BN(user1BlanceBefore);
                assert.equal(user1BlanceBefore.toString(), new web3.utils.BN(user1BlanceAfter).toString());
            })
        })

        describe('When the answer is not revealed(Not Mined)', function () {
            // betting 전후로 스마트컨트랙 balance, userbalance, pot money
            it('should get the eth of user when the answer does not match at all', async () => {
                // 다 틀렸을 때
                await lottery.setAnswerForTest('0xab17b7e54b0ee749f38a478df0f485fc8a99c6aaa8d2aae379a09827aeb5301e', {from : deployer});
                await lottery.betAndDistribute('0xef', {from : user2, value : betAmount}); // 1 -> 4
                await lottery.betAndDistribute('0xab', {from : user1, value : betAmount}); // 2 -> 5

                let user1BlanceBefore = await web3.eth.getBalance(user1);

                // 아래 컨트랙트를 실행해도 user1이 맞춘 betting + 4 block이 생성되지 않기 때문에 정답을 맞추어도 pot의 변화가 없다.
                await lottery.betAndDistribute('0xef', {from : user2, value : betAmount}); // 3 -> 6
                
                let user1BlanceAfter = await web3.eth.getBalance(user1); // == before - betAmountBN

                //pot money == 0 ETH
                let pot = await lottery.getPot(); //  == 0 ETH
                assert.equal(pot, 0);

                // contract balance == 0.0015 ETH
                let contractBlance = await web3.eth.getBalance(lottery.address);
                assert.equal(contractBlance, betAmountBN * 3);

                // user1blance check
                user1BlanceBefore = new web3.utils.BN(user1BlanceBefore);
                assert.equal(user1BlanceBefore.toString(), new web3.utils.BN(user1BlanceAfter).toString());
            })

        })

        describe.only('When the answer is not revealed(Block limit is passed)', function () {
            // ganache에서는 컨트랙을 날리면 바로 block 하나가 생성됨으로 
            // await lottery.setAnswerForTest('0xab17b7e54b0ee749f38a478df0f485fc8a99c6aaa8d2aae379a09827aeb5301e', {from : deployer});
            // 컨트랙트 또는 다른 컨트랙트를 300번 날리는게 방법이 될 수 있고,
            // 두번째 방법으로 ganache-cli를 사용한다면 rpc-call중에 evm_mine을 사용하면
            // 블록을 증가시킬 수 있고, evm_increaseTime을 통해 시간을 증가시킬 수 있다.
            it('should get the eth of user when the answer does not match at all', async () => {
            // usermoney에 refund가 제대로 되었는지, pot money는 0인지 확인한다.
            await lottery.setAnswerForTest('0xab17b7e54b0ee749f38a478df0f485fc8a99c6aaa8d2aae379a09827aeb5301e', {from : deployer});
            await lottery.betAndDistribute('0xab', {from : user1, value : betAmount}); 
            // 위 betting을 채굴할 수 없도록 block을 300개 더 생성한다. 가장 최근 256개의 block만 조회가 가능하다.
            for (let i = 0; i < 300; i++) {
                await lottery.setAnswerForTest('0xab17b7e54b0ee749f38a478df0f485fc8a99c6aaa8d2aae379a09827aeb5301e', {from : deployer});
            }

            let user1BlanceBefore = await web3.eth.getBalance(user1);

            // betAndDistribute 함수를 실행하여 distribute 함수에서 user1의 betting이 refund 되도록 한다.
            await lottery.betAndDistribute('0xab', {from : user2, value : betAmount});

            let user1BlanceAfter = await web3.eth.getBalance(user1); // == before + betAmountBN

            // pot == 0 ETH
            let pot = await lottery.getPot(); //  == 0 ETH
            assert.equal(pot, 0);

            // refund check
            user1BlanceBefore = new web3.utils.BN(user1BlanceBefore);
            assert.equal(user1BlanceBefore.add(betAmountBN).toString(), new web3.utils.BN(user1BlanceAfter).toString());
            })
        })
    })
})