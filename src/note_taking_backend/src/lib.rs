use candid::CandidType;
use candid::{Decode, Encode, Principal};
use ic_cdk::api::stable::StableIO;
use ic_cdk::{caller, storage};
use ic_cdk_macros::{query, update};
use ic_stable_structures::{
    memory_manager::{MemoryId, MemoryManager, VirtualMemory},
    Cell, DefaultMemoryImpl, StableBTreeMap, Storable,
};
use serde::{Deserialize, Serialize};
use std::{borrow::Cow, cell::RefCell};

type Memory = VirtualMemory<DefaultMemoryImpl>;
type IdCell = Cell<u64, Memory>;

#[derive(Clone, Serialize, Deserialize, Debug, CandidType)]
struct Note {
    id: u64,
    title: String,
    content: String,
    owner: Principal,
}

impl Storable for Note {
    fn to_bytes(&self) -> Cow<[u8]> {
        Cow::Owned(Encode!(self).unwrap())
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        Decode!(bytes.as_ref(), Self).unwrap()
    }
}

use ic_stable_structures::storable::BoundedStorable;
impl BoundedStorable for Note {
    const MAX_SIZE: u32 = 2048;
    const IS_FIXED_SIZE: bool = false;
}

thread_local! {
    static MEMORY_MANAGER: RefCell<MemoryManager<DefaultMemoryImpl>> =
        RefCell::new(MemoryManager::init(DefaultMemoryImpl::default()));

    static NOTE_STORAGE: RefCell<StableBTreeMap<u64, Note, Memory>> =
        RefCell::new(StableBTreeMap::init(MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(0)))));

    static NEXT_ID: RefCell<IdCell> =
        RefCell::new(Cell::init(MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(1))), 1).unwrap());
}

fn is_authenticated() -> Result<Principal, String> {
    let caller = caller();
    if caller == Principal::anonymous() {
        Err("Authentication required. Please login with Internet Identity.".to_string())
    } else {
        Ok(caller)
    }
}

#[update]
fn create(title: String, content: String) -> Result<String, String> {
    let owner = is_authenticated()?;
    
    // Get next global ID for storage (to avoid collisions)
    let storage_id = NEXT_ID.with(|next_id| {
        let mut cell = next_id.borrow_mut();
        let current = *cell.get();
        let _ = cell.set(current + 1);
        current
    });
    
    // Get user's next sequential ID (for display)
    let user_max_id = NOTE_STORAGE.with(|store| {
        store
            .borrow()
            .iter()
            .filter(|(_, note)| note.owner == owner)
            .map(|(_, note)| note.id)
            .max()
            .unwrap_or(0)
    });
    
    let user_display_id = user_max_id + 1;

    let new_note = Note {
        id: user_display_id,  // User sees sequential numbers
        title,
        content,
        owner,
    };

    NOTE_STORAGE.with(|store| {
        store.borrow_mut().insert(storage_id, new_note);  // Store with unique key
    });
    
    Ok("Note created successfully".into())
}

#[query]
fn get_notes() -> Vec<Note> {
    let caller_principal = caller();
    if caller_principal == Principal::anonymous() {
        return Vec::new();
    }

    NOTE_STORAGE.with(|store| {
        store
            .borrow()
            .iter()
            .filter(|(_, note)| note.owner == caller_principal)
            .map(|(_, note)| note.clone())
            .collect()
    })
}

#[update]
fn edit(id: u64, title: String, content: String) -> Result<String, String> {
    let caller_principal = is_authenticated()?;

    NOTE_STORAGE.with(|store| {
        let mut store = store.borrow_mut();
        
        let mut search_storage_id = None;
        let mut search_note = None;

        for (storage_id, note) in store.iter(){
            if note.owner == caller_principal && note.id == id {
                search_storage_id = Some(storage_id);
                search_note = Some(note);
                break;
            }

        }

        if let (Some(storage_id), Some(mut note)) = (search_storage_id, search_note) {
            note.title = title;
            note.content = content;
            store.insert(storage_id, note);
            Ok("Note updated successfully".into())
        } else {
            Err("Note not found".into())
        }
    })
}

#[update]
fn delete(id: u64) -> Result<String, String> {
    let caller_principal = is_authenticated()?;

    NOTE_STORAGE.with(|store| {
        let mut store = store.borrow_mut();

        let mut found_storage_id = None;

        for(storage_id, note) in store.iter() {
            if note.owner == caller_principal && note.id == id {
                found_storage_id = Some(storage_id);
                break;
            }
        }

        if let Some(storage_id) = found_storage_id {
            store.remove(&storage_id);
            
            let mut user_notes: Vec<(u64, Note)> = store.iter()
                .filter(|(_,note)| note.owner == caller_principal)
                .collect();
            
            user_notes.sort_by_key(|(_, note)| note.id);

            let storage_ids_to_remove: Vec<u64> = user_notes.iter().map(|(storage_id, _)| *storage_id).collect();
            for storage_id in storage_ids_to_remove {
                store.remove(&storage_id);
            }

            for (index, (storage_id, mut note)) in user_notes.into_iter().enumerate() {
                if note.id > id {
                    note.id = note.id - 1; // Adjust display ID
                }
                store.insert(storage_id, note);
            }

            Ok("Note deleted successfully".to_string())

        } else {
            Err("Note not found or you don't have permission".into())
        }
    })
}

/// Get the caller's principal for frontend display
#[query]
fn get_caller_principal() -> Principal {
    caller()
}

/// Check if user is authenticated
#[query]
fn is_user_authenticated() -> bool {
    caller() != Principal::anonymous()
}

ic_cdk::export_candid!();
