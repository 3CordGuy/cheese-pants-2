interface CloudflareEnv {
  CHEESE_PANTS_2: DurableObjectNamespace<
    import("./worker/src/index").CheesePants2
  >;
  RPC_SERVICE: Service<import("./worker/src/index").CheesePants2RPC>;
  ASSETS: Fetcher;
}
