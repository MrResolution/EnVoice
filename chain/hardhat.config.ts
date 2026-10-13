import { defineConfig } from 'hardhat/config'

// Local chain only. Scripts talk to `hardhat node` over JSON-RPC with ethers, so no plugins are needed.
export default defineConfig({
  solidity: '0.8.28',
})
