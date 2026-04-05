module pinitia::prediction_market {
    use std::signer;
    use std::string::String;
    use std::error;
    use std::vector;

    use initia_std::table::{Self, Table};
    use initia_std::primary_fungible_store;
    use initia_std::coin;
    use initia_std::object::{Self, ExtendRef};
    use initia_std::block;
    use initia_std::event;

    // ========== Error codes ==========
    const ENOT_OWNER: u64 = 1;
    const ENOT_ORACLE: u64 = 2;
    const EMARKET_RESOLVED: u64 = 3;
    const EMARKET_NOT_RESOLVED: u64 = 4;
    const EBETTING_CLOSED: u64 = 5;
    const EZERO_AMOUNT: u64 = 6;
    const EALREADY_CLAIMED: u64 = 7;
    const ENO_WINNINGS: u64 = 8;
    const EMAX_MARKETS_PER_PLACE: u64 = 9;
    const ERESOLVE_DATE_NOT_PASSED: u64 = 10;
    const EINVALID_MARKET_ID: u64 = 11;
    const EARRAY_LENGTH_MISMATCH: u64 = 12;
    const EALREADY_INITIALIZED: u64 = 13;
    const ERESOLVE_DATE_IN_PAST: u64 = 15;

    // ========== Constants ==========
    const MARKET_TYPE_VELOCITY: u8 = 0;
    const MARKET_TYPE_RATING: u8 = 1;
    const FEE_BPS: u64 = 200; // 2%
    const BPS_DENOMINATOR: u64 = 10000;
    const MAX_MARKETS_PER_PLACE: u64 = 5;

    // ========== Vault marker ==========
    struct VaultTag has key {}

    // ========== Resources ==========

    struct MarketRegistry has key {
        markets: Table<u64, Market>,
        place_markets: Table<String, vector<u64>>,
        all_active_market_ids: vector<u64>,
        next_market_id: u64,
        owner: address,
        oracle: address,
        denom: String,
        vault_extend_ref: ExtendRef,
        vault_addr: address,
    }

    struct Market has store {
        market_type: u8,
        place_id: String,
        target: u64,
        resolve_date: u64,
        initial_review_count: u64,
        long_pool: u64,
        short_pool: u64,
        final_rating: u64,
        final_review_count: u64,
        resolved: bool,
        long_wins: bool,
        long_bets: Table<address, u64>,
        short_bets: Table<address, u64>,
        claimed: Table<address, bool>,
        bet_entries: vector<BetEntry>,
    }

    struct BetEntry has store, drop, copy {
        user: address,
        is_long: bool,
        amount: u64,
    }

    // ========== Events ==========

    #[event]
    struct BetPlaced has drop, store {
        market_id: u64,
        user: address,
        is_long: bool,
        amount: u64,
    }

    #[event]
    struct MarketResolvedEvent has drop, store {
        market_id: u64,
        long_wins: bool,
    }

    #[event]
    struct WinningsClaimed has drop, store {
        market_id: u64,
        user: address,
        amount: u64,
    }

    #[event]
    struct MarketCreated has drop, store {
        market_id: u64,
        place_id: String,
        market_type: u8,
        target: u64,
        resolve_date: u64,
    }

    #[event]
    struct PlaceDataPosted has drop, store {
        place_id: String,
        rating: u64,
        review_count: u64,
    }

    // ========== Initialize ==========

    public entry fun initialize(account: &signer, oracle: address, denom: String) {
        let addr = signer::address_of(account);
        assert!(!exists<MarketRegistry>(addr), error::already_exists(EALREADY_INITIALIZED));

        // Create a vault object to hold all bet coins
        let constructor_ref = object::create_object(addr, false);
        let vault_signer = object::generate_signer(&constructor_ref);
        let vault_extend_ref = object::generate_extend_ref(&constructor_ref);
        let vault_addr = signer::address_of(&vault_signer);

        // Mark the vault object
        move_to(&vault_signer, VaultTag {});

        move_to(account, MarketRegistry {
            markets: table::new(),
            place_markets: table::new(),
            all_active_market_ids: vector::empty(),
            next_market_id: 0,
            owner: addr,
            oracle,
            denom,
            vault_extend_ref,
            vault_addr,
        });
    }

    // ========== Market Creation (owner only) ==========

    public entry fun create_velocity_market(
        account: &signer,
        place_id: String,
        target: u64,
        resolve_date: u64,
        initial_review_count: u64,
    ) acquires MarketRegistry {
        let addr = signer::address_of(account);
        create_market(addr, MARKET_TYPE_VELOCITY, place_id, target, resolve_date, initial_review_count);
    }

    public entry fun create_rating_market(
        account: &signer,
        place_id: String,
        target: u64,
        resolve_date: u64,
    ) acquires MarketRegistry {
        let addr = signer::address_of(account);
        create_market(addr, MARKET_TYPE_RATING, place_id, target, resolve_date, 0);
    }

    fun create_market(
        owner_addr: address,
        market_type: u8,
        place_id: String,
        target: u64,
        resolve_date: u64,
        initial_review_count: u64,
    ) acquires MarketRegistry {
        let registry = borrow_global_mut<MarketRegistry>(owner_addr);
        assert!(owner_addr == registry.owner, error::permission_denied(ENOT_OWNER));

        let now = block::get_current_block_timestamp();
        assert!(resolve_date > now, error::invalid_argument(ERESOLVE_DATE_IN_PAST));

        // Check max markets per place
        if (table::contains(&registry.place_markets, place_id)) {
            let place_market_ids = table::borrow(&registry.place_markets, place_id);
            assert!(
                vector::length(place_market_ids) < MAX_MARKETS_PER_PLACE,
                error::invalid_state(EMAX_MARKETS_PER_PLACE),
            );
        };

        let market_id = registry.next_market_id;
        registry.next_market_id = market_id + 1;

        let market = Market {
            market_type,
            place_id,
            target,
            resolve_date,
            initial_review_count,
            long_pool: 0,
            short_pool: 0,
            final_rating: 0,
            final_review_count: 0,
            resolved: false,
            long_wins: false,
            long_bets: table::new(),
            short_bets: table::new(),
            claimed: table::new(),
            bet_entries: vector::empty(),
        };

        table::add(&mut registry.markets, market_id, market);

        // Track place -> market mapping
        if (!table::contains(&registry.place_markets, place_id)) {
            table::add(&mut registry.place_markets, place_id, vector::empty());
        };
        let place_ids = table::borrow_mut(&mut registry.place_markets, place_id);
        vector::push_back(place_ids, market_id);

        vector::push_back(&mut registry.all_active_market_ids, market_id);

        event::emit(MarketCreated {
            market_id,
            place_id,
            market_type,
            target,
            resolve_date,
        });
    }

    // ========== Betting ==========

    public entry fun bet_long(
        account: &signer,
        module_addr: address,
        market_id: u64,
        amount: u64,
    ) acquires MarketRegistry {
        place_bet(account, module_addr, market_id, true, amount);
    }

    public entry fun bet_short(
        account: &signer,
        module_addr: address,
        market_id: u64,
        amount: u64,
    ) acquires MarketRegistry {
        place_bet(account, module_addr, market_id, false, amount);
    }

    fun place_bet(
        account: &signer,
        module_addr: address,
        market_id: u64,
        is_long: bool,
        amount: u64,
    ) acquires MarketRegistry {
        assert!(amount > 0, error::invalid_argument(EZERO_AMOUNT));

        let registry = borrow_global_mut<MarketRegistry>(module_addr);
        assert!(table::contains(&registry.markets, market_id), error::not_found(EINVALID_MARKET_ID));

        let market = table::borrow_mut(&mut registry.markets, market_id);
        assert!(!market.resolved, error::invalid_state(EMARKET_RESOLVED));

        let now = block::get_current_block_timestamp();
        assert!(now < market.resolve_date, error::invalid_state(EBETTING_CLOSED));

        // Transfer coins from bettor to vault
        let metadata = coin::denom_to_metadata(registry.denom);
        let coins = primary_fungible_store::withdraw(account, metadata, amount);
        primary_fungible_store::deposit(registry.vault_addr, coins);

        let user_addr = signer::address_of(account);

        if (is_long) {
            market.long_pool = market.long_pool + amount;
            if (table::contains(&market.long_bets, user_addr)) {
                let existing = table::borrow_mut(&mut market.long_bets, user_addr);
                *existing = *existing + amount;
            } else {
                table::add(&mut market.long_bets, user_addr, amount);
            };
        } else {
            market.short_pool = market.short_pool + amount;
            if (table::contains(&market.short_bets, user_addr)) {
                let existing = table::borrow_mut(&mut market.short_bets, user_addr);
                *existing = *existing + amount;
            } else {
                table::add(&mut market.short_bets, user_addr, amount);
            };
        };

        // Record bet entry for querying
        vector::push_back(&mut market.bet_entries, BetEntry {
            user: user_addr,
            is_long,
            amount,
        });

        event::emit(BetPlaced {
            market_id,
            user: user_addr,
            is_long,
            amount,
        });
    }

    // ========== Oracle: Post Data & Auto-Resolve ==========

    public entry fun post_place_data(
        account: &signer,
        module_addr: address,
        place_id: String,
        rating: u64,
        review_count: u64,
    ) acquires MarketRegistry {
        let sender = signer::address_of(account);
        let registry = borrow_global_mut<MarketRegistry>(module_addr);
        assert!(sender == registry.oracle, error::permission_denied(ENOT_ORACLE));

        event::emit(PlaceDataPosted { place_id, rating, review_count });

        resolve_eligible(registry, place_id, rating, review_count);
    }

    public entry fun batch_post(
        account: &signer,
        module_addr: address,
        place_ids: vector<String>,
        ratings: vector<u64>,
        review_counts: vector<u64>,
    ) acquires MarketRegistry {
        let sender = signer::address_of(account);
        let registry = borrow_global_mut<MarketRegistry>(module_addr);
        assert!(sender == registry.oracle, error::permission_denied(ENOT_ORACLE));

        let len = vector::length(&place_ids);
        assert!(len == vector::length(&ratings), error::invalid_argument(EARRAY_LENGTH_MISMATCH));
        assert!(len == vector::length(&review_counts), error::invalid_argument(EARRAY_LENGTH_MISMATCH));

        let i = 0;
        while (i < len) {
            let place_id = *vector::borrow(&place_ids, i);
            let rating = *vector::borrow(&ratings, i);
            let review_count = *vector::borrow(&review_counts, i);

            event::emit(PlaceDataPosted { place_id, rating, review_count });
            resolve_eligible(registry, place_id, rating, review_count);

            i = i + 1;
        };
    }

    fun resolve_eligible(
        registry: &mut MarketRegistry,
        place_id: String,
        rating: u64,
        review_count: u64,
    ) {
        if (!table::contains(&registry.place_markets, place_id)) return;

        let market_ids = *table::borrow(&registry.place_markets, place_id);
        let now = block::get_current_block_timestamp();
        let i = 0;
        let len = vector::length(&market_ids);

        while (i < len) {
            let market_id = *vector::borrow(&market_ids, i);
            let market = table::borrow_mut(&mut registry.markets, market_id);

            if (!market.resolved && now >= market.resolve_date) {
                resolve_market_internal(market, market_id, rating, review_count);
            };

            i = i + 1;
        };
    }

    fun resolve_market_internal(
        market: &mut Market,
        market_id: u64,
        rating: u64,
        review_count: u64,
    ) {
        market.final_rating = rating;
        market.final_review_count = review_count;
        market.resolved = true;

        if (market.market_type == MARKET_TYPE_VELOCITY) {
            if (review_count >= market.initial_review_count) {
                market.long_wins = (review_count - market.initial_review_count) >= market.target;
            } else {
                market.long_wins = false;
            };
        } else {
            // RATING: longWins = finalRating >= target
            market.long_wins = rating >= market.target;
        };

        event::emit(MarketResolvedEvent {
            market_id,
            long_wins: market.long_wins,
        });
    }

    // ========== Force Resolve (owner or oracle) ==========

    public entry fun force_resolve_market(
        account: &signer,
        module_addr: address,
        market_id: u64,
        rating: u64,
        review_count: u64,
    ) acquires MarketRegistry {
        let sender = signer::address_of(account);
        let registry = borrow_global_mut<MarketRegistry>(module_addr);
        assert!(
            sender == registry.owner || sender == registry.oracle,
            error::permission_denied(ENOT_OWNER),
        );
        assert!(table::contains(&registry.markets, market_id), error::not_found(EINVALID_MARKET_ID));

        let market = table::borrow_mut(&mut registry.markets, market_id);
        assert!(!market.resolved, error::invalid_state(EMARKET_RESOLVED));

        resolve_market_internal(market, market_id, rating, review_count);
    }

    // ========== Claim Winnings ==========

    public entry fun claim(
        account: &signer,
        module_addr: address,
        market_id: u64,
    ) acquires MarketRegistry {
        let user_addr = signer::address_of(account);
        let registry = borrow_global_mut<MarketRegistry>(module_addr);
        assert!(table::contains(&registry.markets, market_id), error::not_found(EINVALID_MARKET_ID));

        let market = table::borrow_mut(&mut registry.markets, market_id);
        assert!(market.resolved, error::invalid_state(EMARKET_NOT_RESOLVED));

        // Check not already claimed
        assert!(
            !table::contains(&market.claimed, user_addr) || !*table::borrow(&market.claimed, user_addr),
            error::invalid_state(EALREADY_CLAIMED),
        );

        let user_bet: u64;
        let winning_pool_amount: u64;
        let losing_pool_amount: u64;

        if (market.long_wins) {
            assert!(table::contains(&market.long_bets, user_addr), error::not_found(ENO_WINNINGS));
            user_bet = *table::borrow(&market.long_bets, user_addr);
            winning_pool_amount = market.long_pool;
            losing_pool_amount = market.short_pool;
        } else {
            assert!(table::contains(&market.short_bets, user_addr), error::not_found(ENO_WINNINGS));
            user_bet = *table::borrow(&market.short_bets, user_addr);
            winning_pool_amount = market.short_pool;
            losing_pool_amount = market.long_pool;
        };

        assert!(user_bet > 0, error::invalid_state(ENO_WINNINGS));

        // Calculate payout: user_bet + (losing_pool * (1 - fee) * user_bet / winning_pool)
        let fee = (losing_pool_amount * FEE_BPS) / BPS_DENOMINATOR;
        let distributable = losing_pool_amount - fee;
        let bonus = (distributable * user_bet) / winning_pool_amount;
        let total_payout = user_bet + bonus;

        // Mark claimed
        if (table::contains(&market.claimed, user_addr)) {
            let claimed_ref = table::borrow_mut(&mut market.claimed, user_addr);
            *claimed_ref = true;
        } else {
            table::add(&mut market.claimed, user_addr, true);
        };

        // Transfer from vault to user
        let vault_signer = object::generate_signer_for_extending(&registry.vault_extend_ref);
        let metadata = coin::denom_to_metadata(registry.denom);
        let payout_coins = primary_fungible_store::withdraw(&vault_signer, metadata, total_payout);
        primary_fungible_store::deposit(user_addr, payout_coins);

        event::emit(WinningsClaimed {
            market_id,
            user: user_addr,
            amount: total_payout,
        });
    }

    // ========== Admin ==========

    public entry fun set_oracle(
        account: &signer,
        new_oracle: address,
    ) acquires MarketRegistry {
        let addr = signer::address_of(account);
        let registry = borrow_global_mut<MarketRegistry>(addr);
        assert!(addr == registry.owner, error::permission_denied(ENOT_OWNER));
        registry.oracle = new_oracle;
    }

    public entry fun transfer_ownership(
        account: &signer,
        new_owner: address,
    ) acquires MarketRegistry {
        let addr = signer::address_of(account);
        let registry = borrow_global_mut<MarketRegistry>(addr);
        assert!(addr == registry.owner, error::permission_denied(ENOT_OWNER));
        registry.owner = new_owner;
    }

    public entry fun withdraw_fees(
        account: &signer,
        recipient: address,
        amount: u64,
    ) acquires MarketRegistry {
        let addr = signer::address_of(account);
        let registry = borrow_global_mut<MarketRegistry>(addr);
        assert!(addr == registry.owner, error::permission_denied(ENOT_OWNER));

        let vault_signer = object::generate_signer_for_extending(&registry.vault_extend_ref);
        let metadata = coin::denom_to_metadata(registry.denom);
        let fees = primary_fungible_store::withdraw(&vault_signer, metadata, amount);
        primary_fungible_store::deposit(recipient, fees);
    }

    // ========== View Functions ==========

    #[view]
    public fun get_active_markets(module_addr: address): vector<u64> acquires MarketRegistry {
        let registry = borrow_global<MarketRegistry>(module_addr);
        registry.all_active_market_ids
    }

    #[view]
    public fun get_markets_by_place(module_addr: address, place_id: String): vector<u64> acquires MarketRegistry {
        let registry = borrow_global<MarketRegistry>(module_addr);
        if (table::contains(&registry.place_markets, place_id)) {
            *table::borrow(&registry.place_markets, place_id)
        } else {
            vector::empty()
        }
    }

    #[view]
    public fun get_market_info(
        module_addr: address,
        market_id: u64,
    ): (u8, String, u64, u64, u64, u64, u64, u64, u64, bool, bool) acquires MarketRegistry {
        let registry = borrow_global<MarketRegistry>(module_addr);
        assert!(table::contains(&registry.markets, market_id), error::not_found(EINVALID_MARKET_ID));
        let market = table::borrow(&registry.markets, market_id);

        (
            market.market_type,
            market.place_id,
            market.target,
            market.resolve_date,
            market.long_pool,
            market.short_pool,
            market.initial_review_count,
            market.final_rating,
            market.final_review_count,
            market.resolved,
            market.long_wins,
        )
    }

    #[view]
    public fun get_user_position(
        module_addr: address,
        market_id: u64,
        user: address,
    ): (u64, u64, u64) acquires MarketRegistry {
        let registry = borrow_global<MarketRegistry>(module_addr);
        assert!(table::contains(&registry.markets, market_id), error::not_found(EINVALID_MARKET_ID));
        let market = table::borrow(&registry.markets, market_id);

        let long_amount = if (table::contains(&market.long_bets, user)) {
            *table::borrow(&market.long_bets, user)
        } else { 0 };

        let short_amount = if (table::contains(&market.short_bets, user)) {
            *table::borrow(&market.short_bets, user)
        } else { 0 };

        let claimable = 0u64;
        if (market.resolved) {
            let already_claimed = table::contains(&market.claimed, user) && *table::borrow(&market.claimed, user);
            if (!already_claimed) {
                let user_bet = if (market.long_wins) { long_amount } else { short_amount };
                if (user_bet > 0) {
                    let winning_pool = if (market.long_wins) { market.long_pool } else { market.short_pool };
                    let losing_pool = if (market.long_wins) { market.short_pool } else { market.long_pool };
                    let fee = (losing_pool * FEE_BPS) / BPS_DENOMINATOR;
                    let distributable = losing_pool - fee;
                    let bonus = if (winning_pool > 0) {
                        (distributable * user_bet) / winning_pool
                    } else { 0 };
                    claimable = user_bet + bonus;
                };
            };
        };

        (long_amount, short_amount, claimable)
    }

    #[view]
    public fun get_market_bets(
        module_addr: address,
        market_id: u64,
    ): vector<BetEntry> acquires MarketRegistry {
        let registry = borrow_global<MarketRegistry>(module_addr);
        assert!(table::contains(&registry.markets, market_id), error::not_found(EINVALID_MARKET_ID));
        let market = table::borrow(&registry.markets, market_id);
        market.bet_entries
    }

    #[view]
    public fun get_market_count(module_addr: address): u64 acquires MarketRegistry {
        let registry = borrow_global<MarketRegistry>(module_addr);
        registry.next_market_id
    }
}
