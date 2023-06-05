import Head from "next/head";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useEffect, useState } from "react";
import {
  CandyMachine,
  Metaplex,
  Nft,
  NftWithToken,
  PublicKey,
  Sft,
  SftWithToken,
  walletAdapterIdentity,
} from "@metaplex-foundation/js";
import { Keypair, Transaction } from "@solana/web3.js";

import {
  getRemainingAccountsForCandyGuard,
  mintV2Instruction,
} from "@/utils/mintV2";
import { fromTxError } from "@/utils/errors";
export default function Home() {
  const wallet = useWallet();
  const { publicKey } = wallet;
  const netMintPrice = 0.069;
  const { connection } = useConnection();
  const [metaplex, setMetaplex] = useState<Metaplex | null>(null);
  const [candyMachine, setCandyMachine] = useState<CandyMachine | null>(null);
  const [availableMints] = useState<number>(1245);
  const [mintedMints, setMintedMints] = useState<number>(0);
  const totalFees = 0.00561672 + 0.0028536 + 0.00144768;
  const [collection, setCollection] = useState<
    Sft | SftWithToken | Nft | NftWithToken | null
  >(null);
  const [formMessage, setFormMessage] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (wallet && connection && !collection && !candyMachine) {
        if (!process.env.NEXT_PUBLIC_CANDY_MACHINE_ID) {
          throw new Error("Please provide a candy machine id");
        }
        const metaplex = new Metaplex(connection).use(
          walletAdapterIdentity(wallet)
        );
        setMetaplex(metaplex);

        const candyMachine = await metaplex.candyMachines().findByAddress({
          address: new PublicKey(process.env.NEXT_PUBLIC_CANDY_MACHINE_ID),
        });

        setCandyMachine(candyMachine);

        const collection = await metaplex
          .nfts()
          .findByMint({ mintAddress: candyMachine.collectionMintAddress });

        setCollection(collection);

        // Set initial state here
        setMintedMints(candyMachine.itemsMinted.toNumber());

        console.log(collection);
      }
    })();
  }, [wallet, connection]);

  /** Mints NFTs through a Candy Machine using Candy Guards */
  const handleMintV2 = async () => {
    if (!metaplex || !candyMachine || !publicKey || !candyMachine.candyGuard) {
      if (!candyMachine?.candyGuard)
        throw new Error(
          "This app only works with Candy Guards. Please setup your Guards through Sugar."
        );

      throw new Error(
        "Couldn't find the Candy Machine or the connection is not defined."
      );
    }

    try {
      const { remainingAccounts, additionalIxs } =
        getRemainingAccountsForCandyGuard(candyMachine, publicKey);

      const mint = Keypair.generate();
      const { instructions } = await mintV2Instruction(
        candyMachine.candyGuard?.address,
        candyMachine.address,
        publicKey,
        publicKey,
        mint,
        connection,
        metaplex,
        remainingAccounts
      );

      const tx = new Transaction();

      if (additionalIxs?.length) {
        tx.add(...additionalIxs);
      }

      tx.add(...instructions);

      tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

      const txid = await wallet.sendTransaction(tx, connection, {
        signers: [mint],
      });

      const latest = await connection.getLatestBlockhash();
      await connection.confirmTransaction({
        blockhash: latest.blockhash,
        lastValidBlockHeight: latest.lastValidBlockHeight,
        signature: txid,
      });

      // Update state here
      setMintedMints(mintedMints + 1);
    } catch (e) {
      const msg = fromTxError(e);

      if (msg) {
        setFormMessage(msg.message);
      }
    }
  };

  const cost = candyMachine
    ? candyMachine.candyGuard?.guards.solPayment
      ? Number(netMintPrice) + " SOL"
      : "Free mint"
    : "...";

  return (
    <>
      <Head>
        <title>Symph Club</title>
        <meta name="description" content="Symph Club Mint" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "96px 0",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: "32px",
            alignItems: "flex-start",
          }}
        >
          <img
            style={{ maxWidth: "396px", borderRadius: "8px" }}
            src={collection?.json?.image}
          />
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              background: "#111",
              padding: "32px 24px",
              borderRadius: "16px",
              border: "1px solid #222",
              minWidth: "320px",
            }}
          >
            <h1>{collection?.name}</h1>
            <p style={{ color: "#807a82", marginBottom: "32px" }}>
              {collection?.json?.description}
            </p>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                background: "#261727",
                padding: "16px 12px",
                borderRadius: "16px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                <span>Public</span>
                <b>{cost}</b>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: "16px",
                }}
              >
                <span style={{ fontSize: "11px" }}>Minted</span>
                <span style={{ fontSize: "11px" }}>
                  {mintedMints} / {availableMints}
                </span>
              </div>
              <button disabled={!publicKey} onClick={handleMintV2}>
                mint
              </button>
              <WalletMultiButton
                style={{
                  width: "100%",
                  height: "auto",
                  marginTop: "8px",
                  padding: "8px 0",
                  justifyContent: "center",
                  fontSize: "13px",
                  backgroundColor: "#111",
                  lineHeight: "1.45",
                }}
              />
              {formMessage}
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
