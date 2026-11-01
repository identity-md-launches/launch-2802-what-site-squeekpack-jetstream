import { useState } from "react";
import {
  useConnect,
  useConnectors,
  useConnection,
  useDisconnect,
  useSwitchChain,
} from "wagmi";
import { Modal } from "./Modal";
import { Icon } from "./Icons";
import { OPEN_IN, shortAddress } from "./config";

export function WalletSheet({ onClose }: { onClose: () => void }) {
  const { address, isConnected, chainId } = useConnection();
  const connectors = useConnectors();
  const { mutateAsync: connect, isPending } = useConnect();
  const { mutate: disconnect } = useDisconnect();
  const { mutateAsync: switchChain, isPending: switching } = useSwitchChain();
  const [error, setError] = useState(""),
    [pending, setPending] = useState("");
  const mobile =
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) &&
    !connectors.some((c) => c.type === "injected" && c.id !== "injected") &&
    !(window as Window & { ethereum?: unknown }).ethereum;
  const named = connectors.some(
    (c) => c.type === "injected" && c.id !== "injected",
  );
  const listed = [
    ...connectors.filter((c) => c.type === "injected"),
    ...connectors.filter((c) => c.type !== "injected"),
  ].filter(
    (c) =>
      !(c.id === "injected" && named) && (!mobile || c.type !== "injected"),
  );
  return (
    <Modal
      title={isConnected ? "Your wallet" : "Connect a wallet"}
      onClose={onClose}
      className="wallet-modal"
    >
      {isConnected && address ? (
        <>
          <div className="wallet-connected">
            <Icon name="check" size={32} />
            <strong>{shortAddress(address)}</strong>
            <code className="full-address">{address}</code>
          </div>
          <p>
            Use your wallet to sign a score. No gas or token approval is needed.
          </p>
          {chainId !== 1 && (
            <button
              className="secondary full"
              disabled={switching}
              onClick={async () => {
                setError("");
                try {
                  await switchChain({ chainId: 1 });
                } catch {
                  setError(
                    "Network switch was not completed. Reopen your wallet and try again.",
                  );
                }
              }}
            >
              {switching ? "Switching…" : "Switch to Ethereum"}
            </button>
          )}
          <button
            className="secondary full"
            onClick={() => {
              disconnect();
              onClose();
            }}
          >
            Disconnect wallet
          </button>
        </>
      ) : (
        <>
          <p className="modal-intro">
            Play freely. Connect when you want to put your signature on a score.
          </p>
          <div className="wallet-list">
            {mobile &&
              OPEN_IN.map((wallet) => (
                <a
                  className="wallet-row"
                  href={wallet.href(location.href)}
                  key={wallet.id}
                >
                  <img
                    src={`./wallets/${wallet.id}.svg`}
                    width="28"
                    height="28"
                    alt=""
                  />
                  <span>Open in {wallet.name}</span>
                  <Icon name="external" size={16} />
                </a>
              ))}
            {listed.map((connector) => {
              const label =
                connector.id === "injected"
                  ? "Browser wallet"
                  : connector.id === "coinbaseWalletSDK" && mobile
                    ? "Coinbase Smart Wallet"
                    : connector.name;
              return (
                <button
                  className="wallet-row"
                  key={connector.uid}
                  disabled={isPending}
                  onClick={async () => {
                    setError("");
                    setPending(connector.uid);
                    try {
                      await connect({ connector });
                      onClose();
                    } catch (e) {
                      const msg = e instanceof Error ? e.message : "";
                      setError(
                        /reject|denied/i.test(msg)
                          ? "Connection declined. Choose a wallet to try again."
                          : connector.id === "injected"
                            ? "No browser wallet found. Install MetaMask, OKX or Rabby, then refresh."
                            : "Could not connect. Open your wallet and try again.",
                      );
                    } finally {
                      setPending("");
                    }
                  }}
                >
                  {connector.icon ? (
                    <img src={connector.icon} width="28" height="28" alt="" />
                  ) : connector.id === "coinbaseWalletSDK" ? (
                    <img
                      src="./wallets/coinbase.svg"
                      width="28"
                      height="28"
                      alt=""
                    />
                  ) : (
                    <Icon name="wallet" size={28} />
                  )}
                  <span>
                    {label}
                    {pending === connector.uid ? " · Opening…" : ""}
                  </span>
                  <Icon name="chevron" size={16} />
                </button>
              );
            })}
          </div>
          <p className="small muted">
            MetaMask, OKX and Rabby are discovered by their own names when
            installed. On Rabby Mobile, you can also paste this page’s address
            into its Dapps tab.
          </p>
        </>
      )}
      <p className="inline-message" role="status">
        {error}
      </p>
    </Modal>
  );
}
