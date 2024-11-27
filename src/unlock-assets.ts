// Dependencies / modules yang digunakan
import {
  BlockfrostProvider,
  MeshWallet,
  UTxO,
  deserializeAddress,
  serializePlutusScript,
  mConStr0,
  stringToHex,
  MeshTxBuilder,
} from "@meshsdk/core";
import { applyParamsToScript } from "@meshsdk/core-csl";
import * as readline from "node:readline/promises";
import dotenv from "dotenv";
dotenv.config();

// Integrasi smart-contract
import contractBlueprint from "../aiken-workspace/plutus.json";

// Loading environment variable blockfrost API key dan seedphrares wallet
const blockfrostApiKey = process.env.BLOCKFROST_API_KEY || "";
const mnemonic = process.env.MNEMONIC
  ? process.env.MNEMONIC.split(",")
  : "solution,".repeat(24).split(",").slice(0, 24);

// Inisiasi node provider Blockfrost
const nodeProvider = new BlockfrostProvider(blockfrostApiKey);

// Inisiasi Cardano Wallet
const wallet = new MeshWallet({
  networkId: 0, // Testnet preview or preprod
  fetcher: nodeProvider,
  submitter: nodeProvider,
  key: {
    type: "mnemonic",
    words: mnemonic,
  },
});

// User memasukan transaction hash aset yang didepositkan
const txHashFromDesposit = await prompt("Transaction hash from lock: ");
const refNumber = await prompt("Reference Number (17925): ");

// Mendapatkan index utxo berdasarkan transaction hash aset yang didepostikan di contract address
const utxo = await getUtxoByTxHash(txHashFromDesposit);
if (utxo === undefined) throw new Error("UTxO not found");

// Mendapatkan script smart-contract dalam format CBOR
const { scriptCbor } = getScript(contractBlueprint.validators[0].compiledCode);

// Mendapatkan index utxo, alamat wallet, dan kolateral
const { utxos, walletAddress, collateral } = await getWalletInfo();

// Mendapatkan pub key hash sebagai persetujuan user untuk menandatangi transaksi
const signerHash = deserializeAddress(walletAddress).pubKeyHash;

// Membuat draft transaksi
const txBuild = new MeshTxBuilder({
  fetcher: nodeProvider,
  evaluator: nodeProvider,
  verbose: true,
});
const txDraft = await txBuild
  .setNetwork("preprod")
  .spendingPlutusScript("V3")
  .txIn(
    utxo.input.txHash,
    utxo.input.outputIndex,
    utxo.output.amount,
    utxo.output.address
  )
  .txInScript(scriptCbor)
  .txInRedeemerValue(mConStr0([stringToHex(refNumber)]))
  .txInDatumValue(mConStr0([signerHash]))
  .requiredSignerHash(signerHash)
  .changeAddress(walletAddress)
  .txInCollateral(
    collateral.input.txHash,
    collateral.input.outputIndex,
    collateral.output.amount,
    collateral.output.address
  )
  .selectUtxosFrom(utxos)
  .complete();

// Menandatangani transaksi
const signedTx = await wallet.signTx(txDraft);

try {
  // Submit transaksi dan mendapatkan transaksi hash
  const txHash = await wallet.submitTx(signedTx);
  console.log("transaction successful!");
  console.log("TxHash :", txHash);
} catch (error) {
  // Menangani kesalahan jika transaksi gagal
  console.error("Transaction failed :", error);
}

// Fungsi prompt untuk berinteraksi dengan user
async function prompt(question: string): Promise<string> {
  const read = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const response = await read.question(question);
  read.close();
  return response;
}

// Fungsi membaca index utxo berdasarkan transaction hash aset yang didepositkan
async function getUtxoByTxHash(txHash: string): Promise<UTxO> {
  const utxos = await nodeProvider.fetchUTxOs(txHash);
  if (utxos.length === 0) {
    throw new Error("UTxO not found");
  }
  return utxos[0];
}

// Fungsi membaca contract address
function getScript(
  blueprintCompiledCode: string,
  params: string[] = [],
  version: "V1" | "V2" | "V3" = "V3"
) {
  const scriptCbor = applyParamsToScript(blueprintCompiledCode, params);
  const scriptAddr = serializePlutusScript(
    { code: scriptCbor, version: version },
    undefined,
    0
  ).address;

  return { scriptCbor, scriptAddr };
}

// Fungsi membaca informasi wallet
async function getWalletInfo() {
  const utxos = await wallet.getUtxos();
  const collateral = (await wallet.getCollateral())[0];
  const walletAddress = await wallet.getChangeAddress();

  if (!utxos || utxos?.length === 0) {
    throw new Error("No utxos found");
  }
  if (!collateral) {
    throw new Error("No collateral found");
  }
  if (!walletAddress) {
    throw new Error("No wallet address found");
  }

  return { utxos, collateral, walletAddress };
}
