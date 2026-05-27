// import { MockProvider } from "./mock";
import { EnableBankingProvider } from "./enablebanking";

export function getProvider() {
  // return new MockProvider();
  return new EnableBankingProvider();
}
