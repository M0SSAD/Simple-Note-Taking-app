use candid::CandidType;
use candid::{Decode, Encode, Principal};
use ic_cdk::caller;
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

    let id = NEXT_ID.with(|next_id| {
        let mut cell = next_id.borrow_mut();
        let &current = cell.get();
        let _ = cell.set(current + 1);
        current + 1  // Use the incremented value, not current
    });

    let new_note = Note {
        id,
        title,
        content,
        owner,
    };

    NOTE_STORAGE.with(|store| {
        store.borrow_mut().insert(id, new_note.clone());
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
        if let Some(mut note) = store.get(&id) {
            if note.owner != caller_principal {
                return Err("You do not have permission to edit this note".into());
            }
            note.title = title;
            note.content = content;
            store.insert(id, note);
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

        // Check if the note exists and belongs to the caller
        if let Some(note) = store.get(&id) {
            if note.owner != caller_principal {
                return Err("You can only delete your own notes".to_string());
            }
        } else {
            return Err("Note not found".to_string());
        }

        // Get all user's notes sorted by ID
        let mut user_notes: Vec<Note> = store
            .iter()
            .filter(|(_, note)| note.owner == caller_principal)
            .map(|(_, note)| note.clone())
            .collect();
        
        user_notes.sort_by_key(|note| note.id);

        // Remove all user's notes from storage first
        let user_note_ids: Vec<u64> = user_notes.iter().map(|note| note.id).collect();
        for note_id in user_note_ids {
            store.remove(&note_id);
        }

        // Remove the note to be deleted from the vector
        user_notes.retain(|note| note.id != id);

        // Reinsert remaining notes with new sequential IDs starting from 1
        for (index, mut note) in user_notes.into_iter().enumerate() {
            let new_id = (index + 1) as u64;
            note.id = new_id;
            store.insert(new_id, note);
        }

        // Update NEXT_ID to be the next available ID for this user
        // We need to find the highest ID globally and set NEXT_ID appropriately
        let max_global_id = store.iter().map(|(id, _)| id).max().unwrap_or(1);
        NEXT_ID.with(|next_id| {
            let mut cell = next_id.borrow_mut();
            let _ = cell.set(max_global_id);
        });

        Ok("Note deleted successfully and notes reordered".to_string())
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
