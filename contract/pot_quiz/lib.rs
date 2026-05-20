#![cfg_attr(not(feature = "std"), no_std, no_main)]

#[ink::contract]
mod pot_quiz {
    use ink::storage::Mapping;
    use ink::prelude::string::String;
    use ink::prelude::vec::Vec;

    #[derive(scale::Decode, scale::Encode, Clone, Debug, PartialEq)]
    #[cfg_attr(
        feature = "std",
        derive(scale_info::TypeInfo, ink::storage::traits::StorageLayout)
    )]
    pub struct Entry {
        pub player: AccountId,
        pub name: String,
        pub score: u32,
    }

    #[ink(storage)]
    pub struct PotQuiz {
        admin: AccountId,
        bonus_threshold: u32,
        bonus_amount: Balance,
        scores: Mapping<AccountId, u32>,
        names: Mapping<AccountId, String>,
    }

    #[ink(event)]
    pub struct ScoreSaved {
        #[ink(topic)]
        player: AccountId,
        score: u32,
    }

    impl PotQuiz {
        #[ink(constructor)]
        pub fn new(bonus_threshold: u32, bonus_amount: Balance) -> Self {
            Self {
                admin: Self::env().caller(),
                bonus_threshold,
                bonus_amount,
                scores: Mapping::default(),
                names: Mapping::default(),
            }
        }

        #[ink(message)]
        pub fn save_score(&mut self, name: String, score: u32) {
            let caller = self.env().caller();
            self.scores.insert(caller, &score);
            self.names.insert(caller, &name);
            self.env().emit_event(ScoreSaved { player: caller, score });
        }

        #[ink(message, payable)]
        pub fn pay_bonus(&mut self, winner: AccountId) {
            assert_eq!(self.env().caller(), self.admin, "Not admin");
            let score = self.scores.get(winner).unwrap_or(0);
            assert!(score >= self.bonus_threshold, "Score too low");
            self.env().transfer(winner, self.bonus_amount).expect("Transfer failed");
        }

        #[ink(message)]
        pub fn get_score(&self, player: AccountId) -> u32 {
            self.scores.get(player).unwrap_or(0)
        }

        #[ink(message)]
        pub fn get_name(&self, player: AccountId) -> String {
            self.names.get(player).unwrap_or(String::new())
        }

        #[ink(message)]
        pub fn set_bonus(&mut self, threshold: u32, amount: Balance) {
            assert_eq!(self.env().caller(), self.admin, "Not admin");
            self.bonus_threshold = threshold;
            self.bonus_amount = amount;
        }
    }
}