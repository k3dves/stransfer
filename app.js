/* eslint-disable no-unused-vars */
import { auth } from "./utils.js";

var src = {
  id: "",
  playlists: [],
  token: "",
};

var target = {
  id: "",
  playlists: [],
  token: "",
};

async function main() {
  console.log("waiting for source auth");
  let src_token = await auth(false);
  src.token = src_token.access_token;

  src.id = await getProfile(src.token);
  console.log("Source = " + src.id);

  // src.playlists = await getPlaylists(src.token);
  // console.log(`Found ${src.playlists.length} playlists from source`);

  console.log("waiting for target auth");
  let target_token = await auth(true);
  target.token = target_token.access_token;
  target.id = await getProfile(target.token);

  console.log(src.id);
  console.log(target.id);

  //await removeEmpty(target.token, target.playlists);

  const failed = await followPlaylists(target.token, src.playlists);
  console.log(`Failed to follow ${failed} playlists`);
  process.exit(0);
}

main();

async function getProfile(token) {
  const response = await fetch("https://api.spotify.com/v1/me", {
    headers: {
      Authorization: "Bearer " + token,
    },
  });

  const data = await response.json();
  return data.id;
}

async function getPlaylists(token) {
  let playlists = [];
  let url = "https://api.spotify.com/v1/me/playlists";
  let next = url + `?offset=0&limit=50`;
  do {
    let response = await fetch(next, {
      headers: {
        Authorization: "Bearer " + token,
      },
    });

    var data = await response.json();
    if (data.items) {
      data.items.forEach((item) => {
        playlists.push({
          id: item.id,
          name: item.name,
          owner: item.owner.id,
          private: item.public == false,
        });
      });
    } else {
      console.log(data);
      throw new Error("No playlists");
    }
    next = data.next;
  } while (next != null);

  return playlists;
}

async function followPlaylists(token, playlists) {
  let failed = 0;
  let success = 0;
  for (let playlist of playlists) {
    let url = `https://api.spotify.com/v1/playlists/${playlist.id}/followers`;
    //synchronous, so that we don't reach spotify api rate limit.
    let response = await fetch(url, {
      headers: {
        Authorization: "Bearer " + token,
      },
      method: "PUT",
      body: JSON.stringify({ public: false }),
    });

    if (!response.ok) {
      response = await response.json();
      failed += 1;
      console.log(`Failed to follow [${failed}] :: ${playlist.id}`);
      console.log(response);
    } else {
      success += 1;
    }
  }
  console.log(`Followed ${success} playlists`);
  return failed;
}

async function removeEmpty(token, playlists) {
  let failed = 0;
  for (let playlist of playlists) {
    if (playlist.owner === target.id) {
      let url = `https://api.spotify.com/v1/playlists/${playlist.id}/followers`;
      let response = await fetch(url, {
        headers: {
          Authorization: "Bearer " + token,
        },
        method: "DELETE",
      });

      if (!response.ok) {
        failed += 1;
      }
    }
  }
  console.log(`Failed to remove ${failed}`);
}

async function copyPlaylist(srcToken, targetToken, srcId, targetId) {
  var srcTracks = [];

  let next = `https://api.spotify.com/v1/playlists/${srcId}/tracks?offset=0&limit=50&fields=next,items(track(uri))`;

  do {
    let response = await fetch(next, {
      headers: {
        Authorization: "Bearer " + srcToken,
      },
    });
    response = await response.json();
    if (!response.ok) {
      console.log("Failed to get tracks", response);
    }
    response.items.forEach((item) => {
      srcTracks.push(item.track.uri);
    });
    next = response.next;
  } while (next != null);

  console.log(srcTracks.length, srcTracks);

  let url = `https://api.spotify.com/v1/playlists/${targetId}/tracks`;
  let body = JSON.stringify({ uris: srcTracks });
  console.log(body);
  let response = await fetch(url, {
    headers: {
      Authorization: "Bearer " + targetToken,
      "Content-Type": "application/json",
    },
    method: "POST",
    body: body,
  });

  response = await response.json();
  if (!response.ok) {
    console.log("Failed to add tracks", response);
  }
}
